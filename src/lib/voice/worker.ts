import "server-only";
import { and, eq, inArray, isNotNull, isNull, lt, notInArray, sql } from "drizzle-orm";
import { getStore } from "@/config/store";
import { getDb, type StoreDatabase } from "@/db";
import { notifications, voiceItems, voiceRuns } from "@/db/schema";
import { readSettingsForAdmin } from "@/lib/settings";
import { generateGroup, voiceEnabled } from "./provider";
import { paragraphWarnings } from "./facts";
import { policyVersion, VoiceError } from "./model";

const pending = ["queued", "working"] as const;
type Run = typeof voiceRuns.$inferSelect;
type Item = typeof voiceItems.$inferSelect;
const typeOf = (facts: Item["facts"]) => facts.find(f => f.label === "ტიპი")?.value;

// v3 catalog groups see only approved samples of their own product type, so one type's
// phrasing does not leak into another. Earlier policies keep the run's stored samples.
async function styleExamples(db: StoreDatabase, run: Run, items: Item[]) {
  if (run.policy !== policyVersion || run.scope !== "catalog" || !run.basisId) return run.examples ?? [];
  const types = new Set(items.map(i => typeOf(i.facts)));
  const samples = await db.select({ facts: voiceItems.facts, proposal: voiceItems.proposal }).from(voiceItems)
    .where(eq(voiceItems.runId, run.basisId)).orderBy(voiceItems.id);
  return samples.filter(s => s.proposal && types.has(typeOf(s.facts))).map(s => s.proposal!);
}

async function finishRuns(db: StoreDatabase) {
  const open = db.select({ id: voiceItems.runId }).from(voiceItems).where(inArray(voiceItems.status, [...pending]));
  const finished = await db.select({ id: voiceRuns.id, notify: voiceRuns.notifyEmail }).from(voiceRuns)
    .where(and(eq(voiceRuns.storeId, getStore().id), isNull(voiceRuns.completedAt), isNotNull(voiceRuns.policy), notInArray(voiceRuns.id, open)));
  for (const candidate of finished) {
    const recipients = candidate.notify ? (await readSettingsForAdmin()).settings.staff.emails : [];
    await db.transaction(async tx => {
      const [run] = await tx.select().from(voiceRuns).where(eq(voiceRuns.id, candidate.id)).for("update");
      if (run.completedAt) return;
      const items = await tx.select({ status: voiceItems.status }).from(voiceItems).where(eq(voiceItems.runId, run.id));
      if (items.some(i => i.status === "queued" || i.status === "working")) return;
      await tx.update(voiceRuns).set({ completedAt: new Date() }).where(eq(voiceRuns.id, run.id));
      const failed = items.filter(i => i.status === "failed").length;
      const message = failed ? "აღწერების მომზადება დასრულდა. გადასამოწმებელი შეცდომები: " + failed : "აღწერები მზადაა გადასახედად";
      if (recipients.length) await tx.insert(notifications).values(recipients.map(recipient => ({
        event: "voice_ready", channel: "email", audience: "staff", recipient, status: "queued",
        subject: message, body: message + "\n" + (process.env.PUBLIC_BASE_URL ?? "").replace(/\/$/, "") + "/admin/voice/" + run.id,
        dedupeKey: "voice-ready/" + run.id + "/" + recipient,
      }))).onConflictDoNothing({ target: notifications.dedupeKey });
    });
  }
}

export async function processVoiceQueue(generate: typeof generateGroup = generateGroup) {
  const db = await getDb();
  const job = await db.transaction(async tx => {
    const store = eq(voiceRuns.storeId, getStore().id);
    const runIds = tx.select({ id: voiceRuns.id }).from(voiceRuns).where(store);
    await tx.update(voiceItems).set({ status: "failed", error: "დამუშავება შეწყდა. ხელახლა გაშვება შესაძლებელია.",
      lease: null, revision: sql`${voiceItems.revision} + 1` })
      .where(and(inArray(voiceItems.runId, runIds), eq(voiceItems.status, "working"), lt(voiceItems.lease, new Date())));
    if (!voiceEnabled()) return;
    const queued = eq(voiceItems.status, "queued");
    const [run] = await tx.select().from(voiceRuns)
      .where(and(store, inArray(voiceRuns.id, tx.select({ id: voiceItems.runId }).from(voiceItems).where(queued))))
      .orderBy(voiceRuns.createdAt).limit(1).for("update", { skipLocked: true });
    if (!run) return;
    const key = and(eq(voiceItems.runId, run.id), queued);
    const [first] = await tx.select().from(voiceItems).where(key).orderBy(voiceItems.id).limit(1);
    if (!first) return;
    // Existing single-product jobs have no group number. New groups are claimed whole.
    const items = first.groupNo === null ? [first] : await tx.select().from(voiceItems)
      .where(and(key, eq(voiceItems.groupNo, first.groupNo))).orderBy(voiceItems.id);
    await tx.update(voiceItems).set({ status: "working", lease: new Date(Date.now() + 660_000), revision: sql`${voiceItems.revision} + 1` })
      .where(inArray(voiceItems.id, items.map(i => i.id)));
    return { run, items };
  });
  if (job) {
    const { run, items } = job;
    const products = items.map(i => ({ sku: i.productId, facts: i.facts }));
    let result: Awaited<ReturnType<typeof generateGroup>> | undefined;
    let error: string | null = null;
    try {
      result = await generate(run.profile, products, run.model, await styleExamples(db, run, items), run.policy);
    }
    catch (e) { error = e instanceof VoiceError ? e.message : "გენერაციის სერვისთან კავშირი ვერ დასრულდა."; }
    await db.transaction(async tx => {
      // The transaction exposes the whole family together. Revisions fence late responses.
      for (const item of items) {
        const paragraphs = result?.get(item.productId);
        const values = paragraphs ? { status: "review" as const, paragraphs, proposal: paragraphs.map(p => p.text).join("\n\n"),
          flags: [...item.flags, ...paragraphWarnings(paragraphs, item.facts)] } : { status: "failed" as const, error };
        await tx.update(voiceItems).set({ ...values, lease: null, revision: item.revision + 2 })
          .where(and(eq(voiceItems.id, item.id), eq(voiceItems.status, "working"), eq(voiceItems.revision, item.revision + 1)));
      }
    });
  }
  await finishRuns(db);
  return { processed: job?.items.length ?? 0 };
}
