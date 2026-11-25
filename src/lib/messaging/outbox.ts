import "server-only";
import { and, asc, eq, inArray, lt, lte, or } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Order } from "@/db/schema";
import { getStore } from "@/config/store";
import { buildMessages, type MessageEvent } from "./templates";
import { getSmsSender, prepareSmsText } from "./sms";
import { getEmailSender } from "./email";

const { notifications, orderItems, orders } = schema;
const MAX_ATTEMPTS = 6;
const BACKOFF_MIN = [1, 5, 30, 120, 720];   // minutes after attempt 1, 2, 3…
const MINUTE_MS = Number(process.env.NOTIFY_BACKOFF_SCALE_MS ?? 60_000);   // tests set 0

const list = (v?: string) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

/** Turn an order event into queued messages. Duplicates (same order, event, channel, recipient) are ignored. */
export async function enqueue(event: MessageEvent, order: Order) {
  const db = await getDb();
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id)).orderBy(orderItems.id);
  const msgs = buildMessages(event, order, items, getStore(),
                             { emails: list(process.env.STAFF_EMAILS), phones: list(process.env.STAFF_PHONES) });
  if (!msgs.length) return [];
  const rows = await db.insert(notifications).values(msgs.map((m) => ({
    orderId: order.id, event, channel: m.channel, audience: m.audience, recipient: m.recipient,
    subject: m.subject ?? null, body: m.channel === "sms" ? prepareSmsText(m.body) : m.body, html: m.html ?? null,
    status: "queued", dedupeKey: m.dedupe,
  }))).onConflictDoNothing({ target: notifications.dedupeKey }).returning({ id: notifications.id });
  return rows.map((r) => r.id);
}

/**
 * Send what is due. Rows are claimed atomically (status → sending), so two runners never send the same message.
 * A row stuck in "sending" for 10 minutes (crash mid-send) becomes due again.
 */
export async function dispatch(ids?: number[], limit = 50) {
  const db = await getDb();
  const now = new Date();
  const stale = new Date(now.getTime() - 10 * 60_000);
  const due = or(
    and(inArray(notifications.status, ["queued", "failed"]), lte(notifications.nextAttemptAt, now), lt(notifications.attempts, MAX_ATTEMPTS)),
    and(eq(notifications.status, "sending"), lte(notifications.nextAttemptAt, stale)),
  );
  const candidates = await db.select({ id: notifications.id }).from(notifications)
    .where(ids?.length ? and(due, inArray(notifications.id, ids)) : due).orderBy(asc(notifications.id)).limit(limit);
  if (!candidates.length) return { sent: 0, failed: 0 };

  const claimed = await db.update(notifications).set({ status: "sending", nextAttemptAt: now })
    .where(and(inArray(notifications.id, candidates.map((c) => c.id)), due)).returning();

  let sent = 0, failed = 0;
  for (const n of claimed) {
    let result: { ok: boolean; provider: string; ref?: string | null; error?: string };
    // a delayed "payment failed" must not arrive after the customer has paid
    if (n.event === "payment_failed" && n.orderId) {
      const [o] = await db.select({ paymentStatus: orders.paymentStatus }).from(orders).where(eq(orders.id, n.orderId));
      if (o?.paymentStatus === "paid") {
        await db.update(notifications).set({ status: "skipped", lastError: "stale: order already paid" }).where(eq(notifications.id, n.id));
        continue;
      }
    }
    try {
      if (n.channel === "sms") {
        const sms = getSmsSender();
        result = sms ? await sms.send(n.recipient, n.body) : { ok: true, provider: "off" };
      } else {
        const mail = getEmailSender();
        result = mail ? await mail.send({ to: n.recipient, subject: n.subject ?? "", text: n.body, html: n.html })
                      : { ok: true, provider: "off" };
      }
    } catch (e) {
      result = { ok: false, provider: "config", error: String(e) };
    }
    const attempts = n.attempts + 1;
    if (result.ok) {
      sent++;
      await db.update(notifications).set({ status: result.provider === "off" ? "skipped" : "sent", attempts, sentAt: new Date(),
        provider: result.provider, providerRef: result.ref ?? null, lastError: null }).where(eq(notifications.id, n.id));
    } else {
      failed++;
      const wait = BACKOFF_MIN[Math.min(attempts - 1, BACKOFF_MIN.length - 1)];
      await db.update(notifications).set({ status: "failed", attempts, provider: result.provider,
        lastError: (result.error ?? "").slice(0, 500), nextAttemptAt: new Date(Date.now() + wait * MINUTE_MS) })
        .where(eq(notifications.id, n.id));
      console.warn(JSON.stringify({ notification: n.id, channel: n.channel, attempt: attempts, error: result.error }));
    }
  }
  return { sent, failed };
}

export async function notificationsForOrder(orderId: string) {
  const db = await getDb();
  return db.select().from(notifications).where(eq(notifications.orderId, orderId)).orderBy(asc(notifications.id));
}
