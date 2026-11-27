import "server-only";
import { eq } from "drizzle-orm";
import { getStore } from "@/config/store";
import { getDb } from "@/db";
import { storeHomepages } from "@/db/schema";
import { initialHome, localTime, type HomeDocument, type HomePublication } from "./model";
import { HomeInputError, parseHome } from "./validation";

function defaults() {
  const published = initialHome();
  return { storeId: getStore().id, revision: 0, draft: published, published, schedule: null };
}
export async function readEditor() {
  const db = await getDb();
  const [row] = await db.select().from(storeHomepages).where(eq(storeHomepages.storeId, getStore().id));
  return row ?? defaults();
}
export async function readHomePublication(): Promise<HomePublication> {
  const db = await getDb();
  const [row] = await db.select({ published: storeHomepages.published, schedule: storeHomepages.schedule })
    .from(storeHomepages).where(eq(storeHomepages.storeId, getStore().id));
  return row ?? { published: initialHome(), schedule: null };
}
type Change = { kind: "save"; document: HomeDocument } | { kind: "publish" } |
  { kind: "schedule"; start: string; end: string } | { kind: "cancel" };

export async function changeHome(revision: number, change: Change, clock: () => number = Date.now) {
  const db = await getDb();
  return db.transaction(async tx => {
    const seed = defaults();
    const match = eq(storeHomepages.storeId, seed.storeId);
    await tx.insert(storeHomepages).values(seed).onConflictDoNothing();
    const [row] = await tx.select().from(storeHomepages).where(match).for("update");
    if (row.revision !== revision) throw new HomeInputError("მონახაზი სხვა ფანჯრიდან შეიცვალა. განაახლე გვერდი და გადაამოწმე ვერსია.");
    const now = clock();
    let { draft, published, schedule } = row;
    if (schedule && localTime(schedule.start) <= now) {
      if (!schedule.end) { published = schedule.document; schedule = null; }
      else if (localTime(schedule.end) <= now) schedule = null;
    }
    switch (change.kind) {
      case "save": draft = parseHome(change.document); break;
      case "cancel":
        if (!schedule) throw new HomeInputError("დასაგეგმი ვერსია აღარ არის აქტიური.");
        schedule = null; break;
      case "publish":
        if (schedule && localTime(schedule.start) <= now) throw new HomeInputError("ჯერ დაასრულე მიმდინარე კამპანია.");
        published = draft; break;
      case "schedule": {
        if (schedule) throw new HomeInputError("სხვა გამოქვეყნება უკვე დაგეგმილია. მის შესაცვლელად ჯერ გააუქმე ის.");
        const start = localTime(change.start), end = localTime(change.end);
        if (!Number.isFinite(start) || start <= now || (change.end && (!Number.isFinite(end) || end <= start))) {
          throw new HomeInputError("მიუთითე მომავალი დაწყების დრო. დასრულება დაწყების შემდეგ უნდა იყოს.");
        }
        schedule = { start: change.start, end: change.end, document: draft };
        break;
      }
    }
    await tx.update(storeHomepages).set({ revision: revision + 1, draft, published, schedule }).where(match);
    return revision + 1;
  });
}
