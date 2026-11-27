import "server-only";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { getStore } from "@/config/store";
import { getDb, type StoreDatabase } from "@/db";
import { catalogEdits, storeCatalogs, voiceItems, voiceProfiles, voiceRuns } from "@/db/schema";
import { lockedCatalog, nextCatalogVersion, recordProductVersion } from "@/lib/catalog/editorial";
import { factsFor, fingerprint, warnings } from "./facts";
import { configuredModel, voiceEnabled } from "./provider";
import { chooseProducts, defaultProfile, VoiceError, type Scope, type VoiceProfile } from "./model";

type Tx = Parameters<Parameters<StoreDatabase["transaction"]>[0]>[0];
type CatalogRow = typeof storeCatalogs.$inferSelect;
type Edit = typeof catalogEdits.$inferSelect;
const storeId = () => getStore().id;
const profileKey = () => eq(voiceProfiles.storeId, storeId());
const runKey = (id: string) => and(eq(voiceRuns.id, id), eq(voiceRuns.storeId, storeId()));
const currentProfile = async (db: StoreDatabase | Tx) =>
  (await db.select().from(voiceProfiles).where(profileKey()))[0] ?? { profile: defaultProfile, revision: 0 };

export async function saveProfile(revision: number, profile: VoiceProfile) {
  const db = await getDb();
  await db.transaction(async tx => {
    await lockedCatalog(tx);
    const current = await currentProfile(tx);
    if (current.revision !== revision) throw new VoiceError("ხმის პროფილი შეიცვალა. განაახლე გვერდი.");
    const values = { profile, revision: revision + 1 };
    await tx.insert(voiceProfiles).values({ storeId: storeId(), ...values })
      .onConflictDoUpdate({ target: voiceProfiles.storeId, set: values });
  });
}

function protection(edit?: Edit) {
  if (edit?.draft) return "აქვს მიმდინარე მონახაზი";
  if (edit?.live.description !== undefined && !edit.voiceItemId) return "ხელით დაწერილი აღწერა";
}
async function candidates(db: StoreDatabase | Tx, row: CatalogRow) {
  const edits = await db.select().from(catalogEdits).where(eq(catalogEdits.storeId, row.storeId));
  const previous = await db.selectDistinctOn([voiceItems.productId], { id: voiceItems.productId, digest: voiceItems.digest })
    .from(voiceItems).innerJoin(voiceRuns, eq(voiceRuns.id, voiceItems.runId))
    .where(and(eq(voiceRuns.storeId, row.storeId), isNotNull(voiceItems.paragraphs)))
    .orderBy(voiceItems.productId, desc(voiceItems.id));
  const pending = await db.select({ id: voiceItems.productId }).from(voiceItems)
    .innerJoin(voiceRuns, eq(voiceRuns.id, voiceItems.runId))
    .where(and(eq(voiceRuns.storeId, row.storeId), inArray(voiceItems.status, ["queued", "working"])));
  const busy = new Set(pending.map(p => p.id));
  const byId = new Map(edits.map(e => [e.productId, e]));
  const done = new Map(previous.map(p => [p.id, p.digest]));
  const published = new Map(row.published.products.map(p => [p.id, p]));
  const types = new Map(row.source.product_types.map(t => [t.id, t.name]));
  return row.source.products.filter(p => p.visible).map(p => {
    const edit = byId.get(p.id);
    const facts = factsFor(p, types.get(p.product_type) ?? p.product_type);
    const digest = fingerprint(facts);
    const blocked = protection(edit) ?? (busy.has(p.id) ? "აღწერა უკვე მზადდება" :
      p.data_quality.issues.includes("CONFLICT") ? "წყაროში ურთიერთსაწინააღმდეგო მონაცემებია" : "");
    const sourceFlags: string[] = [];
    if (p.data_quality.issues.includes("POSSIBLE_DUPLICATE")) sourceFlags.push("წყაროში მონიშნულია შესაძლო დუბლიკატი.");
    if (p.data_quality.issues.includes("GLUED_SPEC_LINES") || p.data_quality.issues.includes("FEW_SPECS")) sourceFlags.push("გადაამოწმე წყაროს ტექნიკური მონაცემები.");
    return { id: p.id, name: p.name, facts, digest, editRevision: edit?.revision ?? 0, flags: sourceFlags,
      original: published.get(p.id)!.description, blocked, fresh: !done.has(p.id), changed: done.has(p.id) && done.get(p.id) !== digest };
  });
}
export async function voiceDashboard() {
  const db = await getDb();
  const [row] = await db.select().from(storeCatalogs).where(eq(storeCatalogs.storeId, storeId()));
  const [profile, products, runs] = await Promise.all([currentProfile(db), candidates(db, row),
    db.select().from(voiceRuns).where(eq(voiceRuns.storeId, storeId())).orderBy(desc(voiceRuns.createdAt))]);
  return { profile, products: products.map(({ id, name, blocked, fresh, changed }) => ({ id, name, blocked, fresh, changed })), runs };
}
export async function createRun(id: string, scope: Scope, ids: string[], version: number) {
  const db = await getDb();
  return db.transaction(async tx => {
    const row = await lockedCatalog(tx);
    if ((await tx.select({ id: voiceRuns.id }).from(voiceRuns).where(runKey(id))).length) return id;
    if (!voiceEnabled()) throw new VoiceError("გენერაციისთვის სერვერზე დააყენე RODO_OPENAI_API_KEY და RODO_AI_MODEL.");
    const { profile, revision } = await currentProfile(tx);
    if (revision !== version) throw new VoiceError("ხმის პროფილი შეიცვალა. განაახლე გვერდი.");
    const chosen = chooseProducts(await candidates(tx, row), scope, ids);
    const preview = new Set(ids);
    if (chosen.length !== preview.size || chosen.some(p => !preview.has(p.id))) {
      throw new VoiceError("პროდუქტების სია შეიცვალა. გადაამოწმე განახლებული შერჩევა და თავიდან გაუშვი.");
    }
    if (!chosen.length) throw new VoiceError("ამ შერჩევაში დასამუშავებელი პროდუქტი არ არის.");
    await tx.insert(voiceRuns).values({ id, storeId: row.storeId, scope, profileVersion: revision, profile,
      model: configuredModel(), sourceVersion: row.source.generated_at + " / " + row.digest });
    for (let i = 0; i < chosen.length; i += 150) await tx.insert(voiceItems).values(chosen.slice(i, i + 150).map(p => ({
      runId: id, productId: p.id, name: p.name, digest: p.digest, editRevision: p.editRevision, facts: p.facts,
      original: p.original, status: "queued" as const, flags: p.flags,
    })));
    return id;
  });
}
export async function readRun(id: string) {
  const db = await getDb();
  const [run] = await db.select().from(voiceRuns).where(runKey(id));
  if (!run) return null;
  const items = await db.select().from(voiceItems).where(eq(voiceItems.runId, id)).orderBy(voiceItems.id);
  return { run, items };
}

export async function reviewItem(runId: string, id: number, revision: number, intent: "save" | "approve" | "reject" | "retry",
  text: string, acknowledged: boolean, actor: "admin" | "editor") {
  const db = await getDb();
  await db.transaction(async tx => {
    const [run] = await tx.select({ id: voiceRuns.id }).from(voiceRuns).where(runKey(runId));
    if (!run) throw new VoiceError("ჯგუფი ვერ მოიძებნა.");
    const key = and(eq(voiceItems.id, id), eq(voiceItems.runId, runId));
    const [item] = await tx.select().from(voiceItems).where(key).for("update");
    if (!item || item.revision !== revision) throw new VoiceError("ჩანაწერი შეიცვალა. განაახლე გვერდი.");
    if (intent === "retry") {
      if (actor !== "admin" || item.status !== "failed" || !voiceEnabled()) throw new VoiceError("ხელახლა გაშვება მიუწვდომელია.");
      await tx.update(voiceItems).set({ status: "queued", error: null, lease: null, revision: revision + 1 }).where(key);
      return;
    }
    if (!["review", "approved", "rejected"].includes(item.status)) throw new VoiceError("ჩანაწერის განხილვა ამ მდგომარეობაში შეუძლებელია.");
    if (intent === "approve" && actor !== "admin") throw new VoiceError("დამტკიცება მხოლოდ ადმინისტრატორს შეუძლია.");
    if (intent !== "reject" && (!text.trim() || text.length > 7200)) throw new VoiceError("აღწერის სიგრძე უნდა იყოს 1–7200 სიმბოლო.");
    if (intent === "approve") {
      const problems = warnings(text, item.facts);
      if (problems.length) throw new VoiceError(problems.join(" "));
      if (item.flags.length && !acknowledged) throw new VoiceError("გადაამოწმე მონიშნული საკითხები და დაადასტურე შემოწმება.");
    }
    await tx.update(voiceItems).set({ proposal: intent === "reject" ? item.proposal : text.trim(),
      status: intent === "approve" ? "approved" : intent === "reject" ? "rejected" : "review",
      reviewedBy: actor, reviewedAt: new Date(), revision: revision + 1 }).where(key);
  });
}

export async function publishApproved(runId: string, expected: Map<number, number>) {
  const db = await getDb();
  return db.transaction(async tx => {
    const row = await lockedCatalog(tx);
    if (!(await tx.select({ id: voiceRuns.id }).from(voiceRuns).where(runKey(runId))).length) throw new VoiceError("ჯგუფი ვერ მოიძებნა.");
    const approved = await tx.select().from(voiceItems).where(and(eq(voiceItems.runId, runId), eq(voiceItems.status, "approved"))).for("update");
    const selected = approved.filter(i => expected.get(i.id) === i.revision);
    if (!selected.length) throw new VoiceError("გამოსაქვეყნებლად მონიშნე დამტკიცებული აღწერები. თუ სია შეიცვალა, განაახლე გვერდი.");
    const edits = await tx.select().from(catalogEdits).where(and(eq(catalogEdits.storeId, row.storeId), inArray(catalogEdits.productId, selected.map(i => i.productId))));
    const byId = new Map(edits.map(e => [e.productId, e]));
    const sources = new Map(row.source.products.map(p => [p.id, p]));
    const products = new Map(row.published.products.map(p => [p.id, p]));
    const types = new Map(row.source.product_types.map(t => [t.id, t.name]));
    let count = 0, stale = 0;
    for (const item of selected) {
      const source = sources.get(item.productId), old = products.get(item.productId), edit = byId.get(item.productId);
      if (!source?.visible || !old || old.description !== item.original || source.data_quality.issues.includes("CONFLICT") ||
        (edit?.revision ?? 0) !== item.editRevision || protection(edit) ||
        fingerprint(factsFor(source, types.get(source.product_type) ?? source.product_type)) !== item.digest) {
        await tx.update(voiceItems).set({ status: "stale", revision: item.revision + 1 }).where(eq(voiceItems.id, item.id));
        stale++;
        continue;
      }
      const description = item.proposal!;
      const live = { ...edit?.live, description };
      const product = { ...old, description };
      const machineText = item.paragraphs!.map(p => p.text).join("\n\n");
      const values = { live, revision: item.editRevision + 1, voiceItemId: description === machineText ? item.id : null };
      await tx.insert(catalogEdits).values({ productId: item.productId, storeId: row.storeId, ...values })
        .onConflictDoUpdate({ target: [catalogEdits.storeId, catalogEdits.productId], set: values });
      await recordProductVersion(tx, row.storeId, old, product, edit?.live ?? {}, live, "admin");
      await tx.update(voiceItems).set({ status: "published", publishedAt: new Date(), revision: item.revision + 1 }).where(eq(voiceItems.id, item.id));
      products.set(item.productId, product);
      count++;
    }
    if (count) await tx.update(storeCatalogs).set({ published: { ...row.published, generated_at: nextCatalogVersion(row),
      products: [...products.values()] } }).where(eq(storeCatalogs.storeId, row.storeId));
    return { count, stale };
  });
}
