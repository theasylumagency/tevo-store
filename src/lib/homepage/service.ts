import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getStore } from "@/config/store";
import { getDb } from "@/db";
import { homepageHistory, storeCatalogs, storeHomepages } from "@/db/schema";
import { initialHome, localTime, normalizeHome, type HomeDocument, type HomePublication, type HomeSchedule } from "./model";
import { assessHome, summarizeHomeChanges } from "./policy";
import { HomeInputError, parseHome } from "./validation";

export class HomeConflictError extends HomeInputError {}

function defaults() {
  const published = initialHome();
  return { storeId: getStore().id, revision: 0, draft: published, published, schedule: null,
    updatedAt: null, publishedAt: null };
}
function normalizedSchedule(schedule: HomeSchedule | null): HomeSchedule | null {
  return schedule ? { ...schedule, document: normalizeHome(schedule.document) } : null;
}
export async function readEditor(clock: () => number = Date.now) {
  const db = await getDb();
  let [row] = await db.select().from(storeHomepages).where(eq(storeHomepages.storeId, getStore().id));
  if (!row) return defaults();
  const now = clock();
  if (row.schedule && !row.schedule.end && localTime(row.schedule.start) <= now) {
    await activatePermanentHome(() => now);
    [row] = await db.select().from(storeHomepages).where(eq(storeHomepages.storeId, getStore().id));
  }
  const result = { ...row, draft: normalizeHome(row.draft), published: normalizeHome(row.published),
    schedule: normalizedSchedule(row.schedule) };
  if (result.schedule?.end && localTime(result.schedule.end) <= now) result.schedule = null;
  return result;
}
export async function readHomePublication(): Promise<HomePublication> {
  const db = await getDb();
  const [row] = await db.select({ published: storeHomepages.published, schedule: storeHomepages.schedule })
    .from(storeHomepages).where(eq(storeHomepages.storeId, getStore().id));
  return row ? { published: normalizeHome(row.published), schedule: normalizedSchedule(row.schedule) } :
    { published: initialHome(), schedule: null };
}

/** Complete a due permanent release exactly once, including when no administrator edits it. */
export async function activatePermanentHome(clock: () => number = Date.now): Promise<HomePublication> {
  const db = await getDb(), storeId = getStore().id;
  return db.transaction(async tx => {
    const match = eq(storeHomepages.storeId, storeId);
    const [row] = await tx.select().from(storeHomepages).where(match).for("update");
    if (!row) return { published: initialHome(), schedule: null };
    const publication = { published: normalizeHome(row.published), schedule: normalizedSchedule(row.schedule) };
    const schedule = publication.schedule, now = clock();
    if (!schedule || schedule.end || localTime(schedule.start) > now) return publication;
    const [catalogRow] = await tx.select({ catalog: storeCatalogs.published }).from(storeCatalogs)
      .where(eq(storeCatalogs.storeId, storeId)).for("share");
    if (!catalogRow || assessHome(schedule.document, catalogRow.catalog, { now }).errors.length) return publication;
    const revision = row.revision + 1;
    await tx.update(storeHomepages).set({ published: schedule.document, schedule: null, revision,
      publishedAt: new Date(now) }).where(match);
    await tx.insert(homepageHistory).values({ storeId, revision, kind: "activate", actor: "system",
      document: schedule.document, summary: ["ვადის გარეშე დაგეგმილი ვერსია ამოქმედდა და ძირითად ვერსიად დარჩა."],
      createdAt: new Date(now) });
    return { published: schedule.document, schedule: null };
  });
}
export async function readHomeHistory(limit = 20) {
  const db = await getDb();
  const rows = await db.select().from(homepageHistory).where(eq(homepageHistory.storeId, getStore().id))
    .orderBy(desc(homepageHistory.id)).limit(Math.max(1, Math.min(50, Math.floor(limit) || 20)));
  return rows.map(row => ({ ...row, document: normalizeHome(row.document) }));
}

export type HomeChange = { kind: "save"; document: HomeDocument } | { kind: "publish" } |
  { kind: "schedule"; start: string; end: string } | { kind: "cancel" } | { kind: "restore"; id: number };

/** Drafts, schedule snapshots, and the base publication are independent and store-scoped. */
export async function changeHome(revision: number, change: HomeChange, clock: () => number = Date.now) {
  if (!Number.isSafeInteger(revision) || revision < 0) throw new HomeInputError("ვერსიის წაკითხვა ვერ მოხერხდა. განაახლე გვერდი.");
  const db = await getDb();
  return db.transaction(async tx => {
    const seed = defaults();
    const match = eq(storeHomepages.storeId, seed.storeId);
    await tx.insert(storeHomepages).values(seed).onConflictDoNothing();
    const [row] = await tx.select().from(storeHomepages).where(match).for("update");
    if (row.revision !== revision) throw new HomeConflictError("მონახაზი სხვა ფანჯრიდან შეიცვალა. შენი ტექსტი ამ ფანჯარაში შენარჩუნებულია. განაახლე გვერდი და შეადარე ვერსიები.");
    const now = clock();
    let draft = normalizeHome(row.draft), published = normalizeHome(row.published);
    let schedule = normalizedSchedule(row.schedule), publishedAt = row.publishedAt;
    let activated: HomeDocument | null = null;
    const [catalogRow] = await tx.select({ catalog: storeCatalogs.published }).from(storeCatalogs)
      .where(eq(storeCatalogs.storeId, seed.storeId)).for("share");
    if (!catalogRow) throw new HomeInputError("კატალოგის წაკითხვა ვერ მოხერხდა. ძირითადი გვერდი შენარჩუნებულია.");
    const issues = (document: HomeDocument, at: number) => assessHome(document, catalogRow.catalog, { now: at }).errors;
    const validateRelease = (document: HomeDocument, at: number) => {
      const errors = issues(document, at);
      if (errors.length) throw new HomeInputError(errors.map(issue => issue.message).join(" "));
    };

    // A permanent scheduled release becomes the base only while it is still valid.
    // Bounded campaigns never replace the base, so edits made during one survive its end.
    if (schedule && localTime(schedule.start) <= now) {
      if (!schedule.end && !issues(schedule.document, now).length) {
        activated = schedule.document;
        published = schedule.document; publishedAt = new Date(now); schedule = null;
      } else if (schedule.end && localTime(schedule.end) <= now) schedule = null;
    }

    const [prior] = await tx.select({ id: homepageHistory.id }).from(homepageHistory)
      .where(eq(homepageHistory.storeId, seed.storeId)).limit(1);
    if (!prior) await tx.insert(homepageHistory).values({ storeId: seed.storeId, revision: row.revision,
      kind: "baseline", actor: "system", document: normalizeHome(row.published),
      summary: ["ცვლილებებამდე არსებული ძირითადი ვერსია"], createdAt: new Date(now) });

    let snapshot = draft, summary: string[] = [];
    switch (change.kind) {
      case "save": draft = parseHome(change.document); break;
      case "restore": {
        if (!Number.isSafeInteger(change.id) || change.id < 1) throw new HomeInputError("აირჩიე აღსადგენი ვერსია.");
        const [version] = await tx.select().from(homepageHistory).where(and(
          eq(homepageHistory.storeId, seed.storeId), eq(homepageHistory.id, change.id)));
        if (!version) throw new HomeInputError("აღსადგენი ვერსია ვერ მოიძებნა.");
        await tx.insert(homepageHistory).values({ storeId: seed.storeId, revision: row.revision,
          kind: "before_restore", actor: "admin", document: draft,
          summary: ["აღდგენამდე არსებული მონახაზი — საჭიროებისას მისი დაბრუნებაც შეგიძლია."], createdAt: new Date(now) });
        draft = parseHome(version.document);
        snapshot = draft;
        summary = [`ვერსია ${version.revision} აღდგა მონახაზში. გამოსაქვეყნებლად გადაამოწმე წინასწარი ხედი.`];
        break;
      }
      case "cancel":
        if (!schedule) throw new HomeInputError("დაგეგმილი ვერსია აღარ არის აქტიური.");
        snapshot = schedule.document;
        summary = [schedule.end && localTime(schedule.start) <= now ? "კამპანია დასრულდა და ძირითადი ვერსია დაბრუნდა." : "დაგეგმილი გამოქვეყნება გაუქმდა."];
        schedule = null; break;
      case "publish":
        validateRelease(draft, now);
        summary = summarizeHomeChanges(published, draft);
        if (schedule && schedule.end && localTime(schedule.start) <= now) summary.push("განახლდა ძირითადი ვერსია. მიმდინარე კამპანია მის დასრულებამდე რჩება.");
        published = draft; publishedAt = new Date(now); break;
      case "schedule": {
        if (schedule) throw new HomeInputError("სხვა გამოქვეყნება უკვე დაგეგმილია. მის შესაცვლელად ჯერ გააუქმე ის.");
        const start = localTime(change.start), end = localTime(change.end);
        if (!Number.isFinite(start) || start <= now || (change.end && (!Number.isFinite(end) || end <= start))) {
          throw new HomeInputError("მიუთითე მომავალი დაწყების დრო. დასრულება დაწყების შემდეგ უნდა იყოს.");
        }
        validateRelease(draft, start);
        if (draft.preset === "offer" && change.end && draft.offer.end && localTime(draft.offer.end) < end) {
          throw new HomeInputError("შეთავაზება კამპანიაზე ადრე სრულდება. შეათანხმე დასრულების დროები.");
        }
        schedule = { start: change.start, end: change.end, document: draft };
        summary = [...summarizeHomeChanges(published, draft), `დაწყება ${change.start.replace("T", " ")} · თბილისი`,
          change.end ? `დასრულება ${change.end.replace("T", " ")} · თბილისი` : "ვადის გარეშე დაგეგმილი ძირითადი ვერსია"];
        break;
      }
    }
    const nextRevision = revision + 1;
    await tx.update(storeHomepages).set({ revision: nextRevision, draft, published, schedule,
      updatedAt: new Date(now), publishedAt }).where(match);
    if (activated) await tx.insert(homepageHistory).values({ storeId: seed.storeId, revision: nextRevision,
      kind: "activate", actor: "system", document: activated,
      summary: ["ვადის გარეშე დაგეგმილი ვერსია ამოქმედდა და ძირითად ვერსიად დარჩა."], createdAt: new Date(now) });
    // Autosaves update the timestamp, without filling release history with every keystroke.
    if (change.kind !== "save") await tx.insert(homepageHistory).values({ storeId: seed.storeId,
      revision: nextRevision, kind: change.kind, actor: "admin", document: snapshot,
      summary: summary.length ? summary : ["გვერდის შინაარსი შენარჩუნებულია."], createdAt: new Date(now) });
    const publicationChanged = JSON.stringify({ published, schedule }) !== JSON.stringify({
      published: normalizeHome(row.published), schedule: normalizedSchedule(row.schedule),
    });
    return { revision: nextRevision, publicationChanged };
  });
}
