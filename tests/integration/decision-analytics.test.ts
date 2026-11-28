import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../../src/app/api/storefront/decision-events/route";
import { POST as descriptionPOST } from "../../src/app/api/storefront/description-views/route";
import { decisionSummary, businessSummary } from "../../src/lib/analytics/service";
import { descriptionTotals } from "../../src/lib/voice/description-counts";
import { getDb, schema } from "../../src/db";

test("decision analytics has a closed vocabulary, atomic counters, privacy signals and isolated modes", async () => {
  const origin = "https://store.example";
  Object.assign(process.env, { DATABASE_URL: "pglite:memory", STORE_ID: "standard", REVIEW_MODE: "0", PUBLIC_BASE_URL: origin });
  const send = (event: string, headers: Record<string, string> = {}) => POST(new Request(origin + "/api/storefront/decision-events", {
    method: "POST", headers: { origin, "x-decision-event": event, ...headers },
  }));
  assert.equal((await send("search_results", { origin: "https://another.example" })).status, 403);
  assert.equal((await send("search_results", { "sec-fetch-site": "cross-site" })).status, 403);
  assert.equal((await send("sensitive query or product ID")).status, 400);
  assert.equal((await send("search_results", { dnt: "1" })).status, 204);
  assert.equal((await send("search_results", { "sec-gpc": "1" })).status, 204);
  assert.equal((await decisionSummary()).totals.search_results, 0);
  const requests = await Promise.all(Array.from({ length: 8 }, () => send("search_results")));
  assert.ok(requests.every(r => r.status === 204));
  await send("search_feedback_partly");
  await send("checkout_delivery_unknown");
  const summary = await decisionSummary();
  assert.equal(summary.totals.search_results, 8);
  assert.equal(summary.totals.search_feedback_partly, 1);
  assert.equal(summary.totals.checkout_delivery_unknown, 1);
  assert.equal(summary.days.length, 1);
  const db = await getDb();
  const rows = await db.select().from(schema.decisionCounts);
  assert.equal(rows.length, 3);
  assert.deepEqual(Object.keys(rows[0]).sort(), ["count", "day", "event", "review", "storeId"]);
  await db.insert(schema.decisionCounts).values([
    { storeId: "standard", review: false, day: "2000-01-01", event: "search_results", count: 300 },
    { storeId: "standard", review: false, day: "2999-01-01", event: "search_results", count: 300 },
  ]);
  assert.equal((await decisionSummary(7)).totals.search_results, 8);
  assert.equal((await decisionSummary(30)).totals.search_results, 8);
  process.env.REVIEW_MODE = "1";
  await send("search_results");
  assert.equal((await decisionSummary()).totals.search_results, 1);
  assert.equal((await decisionSummary(30, false)).totals.search_results, 8);
  process.env.REVIEW_MODE = "0";
  const before = await descriptionTotals();
  await descriptionPOST(new Request(origin + "/api/storefront/description-views", {
    method: "POST", headers: { origin, dnt: "1", "x-description-event": "open" },
  }));
  assert.deepEqual(await descriptionTotals(), before);

  const order = { storeId: "standard", status: "completed", paymentMethod: "cash", paymentStatus: "paid",
    customerName: "fixture", customerPhone: "+995599000000", deliveryMethod: "pickup", subtotal: 1000, deliveryFee: 0,
    total: 1000, accessToken: "fixture" };
  const [created] = await db.insert(schema.orders).values(order).returning();
  await db.insert(schema.orders).values([
    { ...order, status: "cancelled" },
    { ...order, storeId: "rodo" },
    { ...order, createdAt: new Date("2000-01-01T00:00:00Z") },
  ]);
  const req = { storeId: "standard", customerName: "fixture", customerPhone: "+995599000000",
    deliveryMethod: "pickup", lines: [], catalogVersion: "test", history: [] };
  await db.insert(schema.purchaseRequests).values([
    { ...req, tokenHash: "fixture-1", status: "closed", convertedOrderId: created.id },
    { ...req, tokenHash: "fixture-2", status: "in_review" },
  ]);
  assert.deepEqual(await businessSummary(7), {
    orders: 2, paid: 1, completed: 1, cancelled: 1, requests: 2, awaiting: 1, answered: 0, converted: 1,
  });
  process.env.REVIEW_MODE = "1";
  assert.equal((await businessSummary()).orders, 2, "operational records are storewide, not falsely mode-tagged");
  process.env.STORE_ID = "rodo";
  process.env.REVIEW_MODE = "0";
  assert.equal((await decisionSummary()).totals.search_results, 0);
  assert.equal((await businessSummary()).orders, 1);
  assert.equal((await businessSummary()).requests, 0);
});
