import "server-only";
import { createHash } from "node:crypto";
import { and, desc, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { getStore } from "@/config/store";
import { getDb, type StoreDatabase } from "@/db";
import { catalogEdits, storeCatalogs, voiceItems, voiceProfiles, voiceRuns } from "@/db/schema";
import { lockedCatalog, nextCatalogVersion, recordProductVersion } from "@/lib/catalog/editorial";
import { borrowedFeatures, repeatedAdvice } from "./audit";
import { factsFor, fingerprint, warnings } from "./facts";
import { configuredModel, voiceEnabled } from "./provider";
import { familyLimit, policyVersion, presets, VoiceError, type NewScope, type VoiceProfile } from "./model";

type Tx = Parameters<Parameters<StoreDatabase["transaction"]>[0]>[0];
type CatalogRow = typeof storeCatalogs.$inferSelect;
type Edit = typeof catalogEdits.$inferSelect;
const storeId = () => getStore().id;
const profileKey = () => eq(voiceProfiles.storeId, storeId());
const runKey = (id: string) => and(eq(voiceRuns.id, id), eq(voiceRuns.storeId, storeId()));
const currentProfile = async (db: StoreDatabase | Tx) =>
  (await db.select().from(voiceProfiles).where(profileKey()))[0] ?? { profile: presets[0].profile, revision: 0, activeRunId: null };

async function writeDraft(tx: Tx, version: number, profile: VoiceProfile) {
  const current = await currentProfile(tx);
  if (current.revision !== version) throw new VoiceError("ხმის მონახაზი შეიცვალა. განაახლე გვერდი.");
  if (Object.keys(profile).every(key => current.profile[key as keyof VoiceProfile] === profile[key as keyof VoiceProfile])) return version;
  const values = { profile, revision: version + 1 };
  await tx.insert(voiceProfiles).values({ storeId: storeId(), ...values })
    .onConflictDoUpdate({ target: voiceProfiles.storeId, set: values });
  return values.revision;
}

function protection(edit?: Edit) {
  if (edit?.draft) return "აქვს მიმდინარე მონახაზი";
  if (edit?.live.description !== undefined && !edit.voiceItemId) return "ხელით დაწერილი აღწერა";
}
async function candidates(db: StoreDatabase | Tx, row: CatalogRow) {
  const edits = await db.select().from(catalogEdits).where(eq(catalogEdits.storeId, row.storeId));
  const pending = await db.select({ id: voiceItems.productId }).from(voiceItems)
    .innerJoin(voiceRuns, eq(voiceRuns.id, voiceItems.runId))
    .where(and(eq(voiceRuns.storeId, row.storeId), inArray(voiceItems.status, ["queued", "working"])));
  const busy = new Set(pending.map(p => p.id));
  const byId = new Map(edits.map(e => [e.productId, e]));
  const published = new Map(row.published.products.map(p => [p.id, p]));
  return row.source.products.filter(p => p.visible).map(p => {
    const edit = byId.get(p.id);
    const facts = factsFor(p, row.source);
    const digest = fingerprint(facts);
    const blocked = protection(edit) ?? (busy.has(p.id) ? "აღწერა უკვე მზადდება" :
      p.data_quality.issues.includes("CONFLICT") ? "წყაროში ურთიერთსაწინააღმდეგო მონაცემებია" : "");
    const sourceFlags: string[] = [];
    if (p.data_quality.issues.includes("POSSIBLE_DUPLICATE")) sourceFlags.push("წყაროში მონიშნულია შესაძლო დუბლიკატი.");
    if (p.data_quality.issues.includes("GLUED_SPEC_LINES") || p.data_quality.issues.includes("FEW_SPECS")) sourceFlags.push("გადაამოწმე წყაროს ტექნიკური მონაცემები.");
    return { id: p.id, name: p.name, family: p.product_type, variant: p.variant_group ?? p.brand ?? "", facts, digest, editRevision: edit?.revision ?? 0, flags: sourceFlags,
      original: published.get(p.id)!.description, blocked };
  });
}
type Candidate = Awaited<ReturnType<typeof candidates>>[number];

async function catalogPlan(db: StoreDatabase | Tx, activeId: string, products: Candidate[]) {
  const [active] = await db.select().from(voiceRuns).where(runKey(activeId));
  if (!active?.approvedAt || active.policy !== policyVersion) throw new VoiceError("გამოცადე და დაამტკიცე მაღაზიის ხმა.");
  const samples = await db.select().from(voiceItems).where(eq(voiceItems.runId, activeId)).orderBy(voiceItems.id);
  const prior = await db.select({ sku: voiceItems.productId, digest: voiceItems.digest })
    .from(voiceItems).innerJoin(voiceRuns, eq(voiceItems.runId, voiceRuns.id))
    .where(and(eq(voiceRuns.storeId, storeId()), eq(voiceRuns.basisId, activeId), eq(voiceRuns.scope, "catalog"),
      inArray(voiceItems.status, ["queued", "working", "review", "approved", "published", "rejected"])));
  const done = new Set(prior.map(p => p.sku + "/" + p.digest));
  const chosen = products.filter(p => !p.blocked && !done.has(p.id + "/" + p.digest))
    .sort((a, b) => a.family.localeCompare(b.family) || a.variant.localeCompare(b.variant) || a.name.localeCompare(b.name));
  const reused = new Map(samples.filter(s => s.paragraphs).map(s => [s.productId + "/" + s.digest, s]));
  let group = 0, size = 0, family = "";
  const entries = chosen.map(p => {
    const sample = reused.get(p.id + "/" + p.digest);
    if (sample) return { p, sample, groupNo: null };
    if (family !== p.family || size === familyLimit) { group++; size = 0; family = p.family; }
    size++;
    return { p, sample: undefined, groupNo: group };
  });
  const token = createHash("sha256").update(JSON.stringify(entries.map(({ p, sample, groupNo }) =>
    [p.id, p.digest, p.editRevision, sample?.id ?? null, groupNo]))).digest("hex");
  return { active, entries, token, requests: group, examples: samples.map(s => s.proposal!) };
}

export async function voiceDashboard() {
  const db = await getDb();
  const [row] = await db.select().from(storeCatalogs).where(eq(storeCatalogs.storeId, storeId()));
  const [profile, products, runs] = await Promise.all([currentProfile(db), candidates(db, row),
    db.select().from(voiceRuns).where(eq(voiceRuns.storeId, storeId())).orderBy(desc(voiceRuns.createdAt))]);
  const active = runs.find(r => r.id === profile.activeRunId && r.policy === policyVersion);
  const plan = active ? await catalogPlan(db, active.id, products) : null;
  const lastTrial = runs.find(r => r.scope === "audition");
  const last = lastTrial ? await db.select({ sku: voiceItems.productId }).from(voiceItems)
    .where(eq(voiceItems.runId, lastTrial.id)).orderBy(voiceItems.id) : [];
  const eligible = products.filter(p => !p.blocked);
  const suggested = [...new Set([...last.map(i => i.sku).filter(id => eligible.some(p => p.id === id)),
    ...eligible.map(p => p.id)])].slice(0, 3);
  return { profile, active, runs, suggested, products: products.map(({ id, name, blocked }) => ({ id, name, blocked })),
    plan: plan && { token: plan.token, ids: plan.entries.map(e => e.p.id), reused: plan.entries.filter(e => e.sample).length, requests: plan.requests } };
}

export async function createRun(id: string, scope: NewScope, ids: string[], version: number, basisId: string | null,
  draft?: VoiceProfile, notifyEmail = false, previewToken?: string) {
  const db = await getDb();
  return db.transaction(async tx => {
    const row = await lockedCatalog(tx);
    if ((await tx.select({ id: voiceRuns.id }).from(voiceRuns).where(runKey(id))).length) return id;
    if (!voiceEnabled()) throw new VoiceError("გენერაციის სერვისი გამორთულია.");
    const current = await currentProfile(tx);
    if (current.activeRunId !== basisId) throw new VoiceError("მოქმედი ხმა შეიცვალა. განაახლე გვერდი.");
    const products = await candidates(tx, row);
    const sourceVersion = row.source.generated_at + " / " + row.digest;
    if (scope === "audition") {
      const chosen = ids.map(sku => products.find(p => p.id === sku && !p.blocked));
      if (ids.length !== 3 || new Set(ids).size !== 3 || chosen.some(p => !p)) throw new VoiceError("მონიშნე სამი განსხვავებული, ხელმისაწვდომი პროდუქტი.");
      const profile = draft ?? current.profile;
      const revision = await writeDraft(tx, version, profile);
      await tx.insert(voiceRuns).values({ id, storeId: row.storeId, scope, profileVersion: revision, profile,
        basisId, policy: policyVersion, model: configuredModel(), sourceVersion, notifyEmail });
      await tx.insert(voiceItems).values(chosen.map(p => itemValues(id, p!, 1)));
    } else {
      if (!basisId || scope !== "catalog") throw new VoiceError("ჯერ დაამტკიცე საცდელი ჯგუფის ხმა.");
      const plan = await catalogPlan(tx, basisId, products);
      const preview = new Set(ids);
      if (plan.token !== previewToken || !plan.entries.length || plan.entries.length !== preview.size || plan.entries.some(e => !preview.has(e.p.id))) {
        throw new VoiceError("დასამუშავებელი სია შეიცვალა. გადაამოწმე კატალოგის მოცულობა.");
      }
      await tx.insert(voiceRuns).values({ id, storeId: row.storeId, scope, basisId, policy: policyVersion, notifyEmail,
        profileVersion: plan.active.profileVersion, profile: plan.active.profile, examples: plan.examples,
        model: plan.active.model, sourceVersion });
      for (let i = 0; i < plan.entries.length; i += 100) {
        await tx.insert(voiceItems).values(plan.entries.slice(i, i + 100).map(({ p, sample, groupNo }) => ({
          ...itemValues(id, p, groupNo), ...(sample && { status: "review" as const, paragraphs: sample.paragraphs,
            proposal: sample.proposal, flags: [...new Set([...p.flags, ...sample.flags])] }),
        })));
      }
    }
    return id;
  });
}

function itemValues(runId: string, p: Candidate, groupNo: number | null) {
  return { runId, groupNo, productId: p.id, name: p.name, digest: p.digest, editRevision: p.editRevision,
    original: p.original, facts: p.facts, status: "queued" as const, flags: p.flags };
}

export async function approveVoice(id: string, acknowledged: boolean) {
  const db = await getDb();
  await db.transaction(async tx => {
    const row = await lockedCatalog(tx);
    const [run] = await tx.select().from(voiceRuns).where(runKey(id));
    const current = await currentProfile(tx);
    if (current.activeRunId === id) return;
    if (!run || run.scope !== "audition" || run.policy !== policyVersion || run.profileVersion !== current.revision ||
      run.basisId !== current.activeRunId || run.approvedAt) throw new VoiceError("ხმის მონახაზი ან მოქმედი ვერსია შეიცვალა. ხელახლა გამოცადე ხმა.");
    const items = await tx.select().from(voiceItems).where(eq(voiceItems.runId, id));
    const products = new Map((await candidates(tx, row)).map(p => [p.id, p]));
    if (items.length !== 3 || items.some(i => {
      const p = products.get(i.productId);
      return i.status !== "review" || !i.proposal || !p || p.blocked || p.digest !== i.digest || p.editRevision !== i.editRevision;
    })) throw new VoiceError("სამივე ნიმუში მზად უნდა იყოს და პროდუქტის მონაცემებს შეესაბამებოდეს.");
    if ((items.some(i => i.flags.length) || repeatedAdvice(items).length || borrowedFeatures(items).size) && !acknowledged) throw new VoiceError("გადაამოწმე მონიშნული ნიმუშები.");
    await tx.update(voiceRuns).set({ approvedAt: new Date() }).where(runKey(id));
    await tx.insert(voiceProfiles).values({ storeId: storeId(), activeRunId: id, profile: run.profile, revision: current.revision })
      .onConflictDoUpdate({ target: voiceProfiles.storeId, set: { activeRunId: id } });
  });
}

export async function readRun(id: string) {
  const db = await getDb();
  const [run] = await db.select().from(voiceRuns).where(runKey(id));
  if (!run) return null;
  const items = await db.select().from(voiceItems).where(eq(voiceItems.runId, id)).orderBy(voiceItems.id);

  // One store-scoped query for the last earlier AI proposal per product.
  // Use immutable generated paragraphs, not the editor's possibly modified draft.
  const previousRows = items.length ? await db.selectDistinctOn([voiceItems.productId], {
    productId: voiceItems.productId, runId: voiceItems.runId, paragraphs: voiceItems.paragraphs,
  }).from(voiceItems).innerJoin(voiceRuns, eq(voiceRuns.id, voiceItems.runId))
    .where(and(eq(voiceRuns.storeId, storeId()),
      inArray(voiceItems.productId, [...new Set(items.map(i => i.productId))]),
      lt(voiceItems.id, items[0].id), isNotNull(voiceItems.paragraphs)))
    .orderBy(voiceItems.productId, desc(voiceItems.id)) : [];
  const previous = new Map(previousRows.filter(row => row.paragraphs).map(row => [
    row.productId, { runId: row.runId, text: row.paragraphs!.map(p => p.text).join("\n\n") },
  ]));
  const advice = repeatedAdvice(items);
  const borrowed = borrowedFeatures(items);
  const current = await currentProfile(db);
  const canApprove = !run.approvedAt && run.scope === "audition" && run.policy === policyVersion &&
    run.profileVersion === current.revision && run.basisId === current.activeRunId;
  const canPublish = run.scope !== "audition" && (run.scope !== "catalog" || !!run.completedAt) &&
    (!current.activeRunId || current.activeRunId === run.basisId);
  return { run, items, previous, advice, borrowed, canApprove, canPublish };
}

export async function reviewItem(runId: string, id: number, revision: number, intent: "save" | "approve" | "reject" | "retry",
  text: string, acknowledged: boolean, actor: "admin" | "editor") {
  const db = await getDb();
  await db.transaction(async tx => {
    const [run] = await tx.select().from(voiceRuns).where(runKey(runId)).for("update");
    if (!run) throw new VoiceError("ჯგუფი ვერ მოიძებნა.");
    const key = and(eq(voiceItems.id, id), eq(voiceItems.runId, runId));
    const [item] = await tx.select().from(voiceItems).where(key).for("update");
    if (!item || item.revision !== revision) throw new VoiceError("ჩანაწერი შეიცვალა. განაახლე გვერდი.");
    if (intent === "retry") {
      if (actor !== "admin" || item.status !== "failed" || !voiceEnabled()) throw new VoiceError("ხელახლა გაშვება მიუწვდომელია.");
      const failedGroup = item.groupNo === null ? key : and(eq(voiceItems.runId, runId),
        eq(voiceItems.groupNo, item.groupNo), eq(voiceItems.status, "failed"));
      await tx.update(voiceItems).set({ status: "queued", error: null, lease: null, revision: sql`${voiceItems.revision} + 1` }).where(failedGroup);
      await tx.update(voiceRuns).set({ completedAt: null }).where(runKey(runId));
      return;
    }
    if (run.scope === "audition") throw new VoiceError("საცდელი ჯგუფი ერთიანად მტკიცდება.");
    if (!["review", "approved", "rejected"].includes(item.status)) throw new VoiceError("ჩანაწერის განხილვა ამ მდგომარეობაში შეუძლებელია.");
    if (intent === "approve" && actor !== "admin") throw new VoiceError("დამტკიცება მხოლოდ ადმინისტრატორს შეუძლია.");
    if (intent !== "reject" && (!text.trim() || text.length > 7200)) throw new VoiceError("აღწერის სიგრძე უნდა იყოს 1–7200 სიმბოლო.");
    if (intent === "approve") {
      const problems = warnings(text, item.facts);
      if (problems.length) throw new VoiceError(problems.join(" "));
      const peers = await tx.select().from(voiceItems).where(eq(voiceItems.runId, runId));
      const revised = peers.map(p => p.id === item.id ? { ...p, proposal: text } : p);
      if ((item.flags.length || borrowedFeatures(revised).has(item.productId) ||
        repeatedAdvice(revised).some(a => a.skus.includes(item.productId))) && !acknowledged) throw new VoiceError("გადაამოწმე მონიშნული საკითხები და დაადასტურე შემოწმება.");
    }
    await tx.update(voiceItems).set({ proposal: intent === "reject" ? item.proposal : text.trim(),
      status: intent === "approve" ? "approved" : intent === "reject" ? "rejected" : "review",
      reviewedBy: actor, reviewedAt: new Date(), revision: revision + 1 }).where(key);
  });
}

export async function publishApproved(runId: string, expected: Map<number, number>, catalogReview = false) {
  const db = await getDb();
  return db.transaction(async tx => {
    const row = await lockedCatalog(tx);
    const [run] = await tx.select().from(voiceRuns).where(runKey(runId));
    const current = await currentProfile(tx);
    if (!run || run.scope === "audition" || (current.activeRunId && run.basisId !== current.activeRunId))
      throw new VoiceError("გამოქვეყნება ამ ჯგუფისა და მოქმედი ხმისთვის მიუწვდომელია.");
    const items = await tx.select().from(voiceItems).where(eq(voiceItems.runId, runId)).for("update");
    if ((run.scope === "catalog" && !run.completedAt) || (catalogReview && run.scope !== "catalog")) throw new VoiceError("დაელოდე კატალოგის სრულად დამუშავებას.");
    const borrowed = catalogReview ? borrowedFeatures(items) : new Map();
    const repeated = new Set(catalogReview ? repeatedAdvice(items).flatMap(a => a.skus) : []);
    const selected = items.filter(i => expected.get(i.id) === i.revision && (i.status === "approved" ||
      (catalogReview && i.status === "review" && i.proposal && !i.flags.length && !borrowed.has(i.productId) &&
        !repeated.has(i.productId) && !warnings(i.proposal, i.facts).length)));
    if (!selected.length) throw new VoiceError("გამოსაქვეყნებლად მონიშნე დამტკიცებული აღწერები. თუ სია შეიცვალა, განაახლე გვერდი.");
    const edits = await tx.select().from(catalogEdits).where(and(eq(catalogEdits.storeId, row.storeId), inArray(catalogEdits.productId, selected.map(i => i.productId))));
    const byId = new Map(edits.map(e => [e.productId, e]));
    const sources = new Map(row.source.products.map(p => [p.id, p]));
    const products = new Map(row.published.products.map(p => [p.id, p]));
    let count = 0, stale = 0;
    for (const item of selected) {
      const source = sources.get(item.productId), old = products.get(item.productId), edit = byId.get(item.productId);
      if (!source?.visible || !old || old.description !== item.original || source.data_quality.issues.includes("CONFLICT") ||
        (edit?.revision ?? 0) !== item.editRevision || protection(edit) ||
        fingerprint(factsFor(source, row.source)) !== item.digest) {
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
