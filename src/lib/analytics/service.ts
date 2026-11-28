import "server-only";
import { and, count, eq, gte, lte, lt, sql } from "drizzle-orm";
import { getStore } from "@/config/store";
import { getDb, schema } from "@/db";
import { isDecisionEvent, summarizeRows, type DecisionEvent } from "./model";

const counts = schema.decisionCounts;
const today = sql<string>`(current_timestamp at time zone 'Asia/Tbilisi')::date`;
export type ReportingDays = 7 | 30;
const validDays = (days: ReportingDays) => days === 7 ? 7 : 30;

/** An atomic, bounded daily count; never store the underlying interaction. */
export async function countDecisionEvent(event: DecisionEvent) {
  if (!isDecisionEvent(event)) throw new Error("unknown decision event");
  const { id, showReview } = getStore();
  await (await getDb()).insert(counts).values({ storeId: id, review: showReview, day: today, event, count: 1 })
    .onConflictDoUpdate({ target: [counts.storeId, counts.review, counts.day, counts.event],
      set: { count: sql`least(${counts.count} + 1, 1000000)` } });
}

export async function decisionSummary(days: ReportingDays = 30, review = getStore().showReview) {
  const db = await getDb();
  const rows = await db.select({ day: counts.day, event: counts.event, count: counts.count }).from(counts)
    .where(and(eq(counts.storeId, getStore().id), eq(counts.review, review),
      gte(counts.day, sql`${today} - ${validDays(days) - 1}::int`), lte(counts.day, today)));
  return summarizeRows(rows);
}

/** Operational records predate review-mode tagging. Do not label them as public
 * traffic or divide them by anonymous event counts. Cohorts by creation date. */
export async function businessSummary(days: ReportingDays = 30) {
  const db = await getDb();
  const { orders, purchaseRequests: requests } = schema;
  const storeId = getStore().id;
  const start = sql`((${today} - ${validDays(days) - 1}::int)::timestamp at time zone 'Asia/Tbilisi')`;
  const end = sql`((${today} + 1)::timestamp at time zone 'Asia/Tbilisi')`;
  const [orderRows, requestRows] = await Promise.all([
    db.select({ status: orders.status, paymentStatus: orders.paymentStatus, n: count() }).from(orders)
      .where(and(eq(orders.storeId, storeId), gte(orders.createdAt, start), lt(orders.createdAt, end)))
      .groupBy(orders.status, orders.paymentStatus),
    db.select({ status: requests.status, n: count(),
      converted: sql<number>`(count(*) filter (where ${requests.convertedOrderId} is not null))::int` }).from(requests)
      .where(and(eq(requests.storeId, storeId), gte(requests.createdAt, start), lt(requests.createdAt, end)))
      .groupBy(requests.status),
  ]);
  const orderCount = (predicate: (r: typeof orderRows[number]) => boolean) =>
    orderRows.filter(predicate).reduce((n, r) => n + r.n, 0);
  const requestCount = (predicate: (r: typeof requestRows[number]) => boolean) =>
    requestRows.filter(predicate).reduce((n, r) => n + r.n, 0);
  return {
    orders: orderCount(() => true),
    paid: orderCount(r => r.paymentStatus === "paid" && r.status !== "cancelled"),
    completed: orderCount(r => r.status === "completed"),
    cancelled: orderCount(r => r.status === "cancelled"),
    requests: requestCount(() => true),
    awaiting: requestCount(r => r.status === "new" || r.status === "in_review"),
    answered: requestCount(r => r.status === "answered"),
    converted: requestRows.reduce((n, r) => n + Number(r.converted), 0),
  };
}
