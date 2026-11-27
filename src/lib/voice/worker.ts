import "server-only";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { getStore } from "@/config/store";
import { getDb } from "@/db";
import { voiceItems, voiceRuns } from "@/db/schema";
import { generateDescription, voiceEnabled } from "./provider";
import { paragraphWarnings } from "./facts";
import { VoiceError } from "./model";

export async function processVoiceQueue(generate: typeof generateDescription = generateDescription) {
  if (!voiceEnabled()) return { processed: 0 };
  const db = await getDb();
  const jobs = await db.transaction(async tx => {
    const store = eq(voiceRuns.storeId, getStore().id);
    const runIds = tx.select({ id: voiceRuns.id }).from(voiceRuns).where(store);
    // After a restart, leave interrupted paid requests for an explicit retry.
    await tx.update(voiceItems).set({ status: "failed", error: "დამუშავება შეწყდა. ხელახლა გაშვება შესაძლებელია.",
      lease: null, revision: sql`${voiceItems.revision} + 1` })
      .where(and(inArray(voiceItems.runId, runIds), eq(voiceItems.status, "working"), lt(voiceItems.lease, new Date())));
    const rows = await tx.select({ item: voiceItems, profile: voiceRuns.profile, model: voiceRuns.model }).from(voiceItems)
      .innerJoin(voiceRuns, eq(voiceItems.runId, voiceRuns.id)).where(and(store, eq(voiceItems.status, "queued")))
      .orderBy(voiceItems.id).limit(3).for("update", { of: voiceItems, skipLocked: true });
    if (rows.length) await tx.update(voiceItems).set({ status: "working", lease: new Date(Date.now() + 120000),
      revision: sql`${voiceItems.revision} + 1` }).where(inArray(voiceItems.id, rows.map(r => r.item.id)));
    return rows;
  });
  await Promise.all(jobs.map(async ({ item, profile, model }) => {
    const claim = and(eq(voiceItems.id, item.id), eq(voiceItems.status, "working"), eq(voiceItems.revision, item.revision + 1));
    const complete = { lease: null, revision: item.revision + 2 };
    let paragraphs;
    try {
      paragraphs = await generate(profile, item.facts, model);
    } catch (e) {
      await db.update(voiceItems).set({ ...complete, status: "failed", error: e instanceof VoiceError ? e.message :
        "გენერაციის სერვისთან კავშირი ვერ დასრულდა. სცადე ხელახლა." }).where(claim);
      return;
    }
    await db.update(voiceItems).set({ ...complete, status: "review", paragraphs, proposal: paragraphs.map(p => p.text).join("\n\n"),
      flags: [...item.flags, ...paragraphWarnings(paragraphs, item.facts)] }).where(claim);
  }));
  return { processed: jobs.length };
}
