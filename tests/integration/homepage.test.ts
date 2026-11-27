import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { getDb } from "../../src/db";
import { orderEvents, orderItems, orders } from "../../src/db/schema";
import { initialHome, effectiveHome, localTime, inWindow } from "../../src/lib/homepage/model";
import { changeHome, readEditor, readHomePublication } from "../../src/lib/homepage/service";
import { parseHome } from "../../src/lib/homepage/validation";
import { homeSelection } from "../../src/lib/homepage/selection";
import { confirmedSales } from "../../src/lib/homepage/sales";
import type { Catalog } from "../../src/lib/catalog/types";

Object.assign(process.env, { DATABASE_URL: "pglite:memory", STORE_ID: "rodo", CATALOG_SOURCE: "file", CATALOG_PATH: "data/catalog.json" });
test("store defaults, optimistic edits, independent releases, end boundaries and permanent switches", async () => {
  const doc = initialHome();
  const campaign = { ...doc, preset: "guide" as const };
  const clock = () => localTime("2027-02-01T08:00");
  assert.deepEqual(await readHomePublication(), { published: doc, schedule: null });
  let rev = await changeHome(0, { kind: "save", document: campaign }, clock);
  assert.equal((await readHomePublication()).published.preset, "catalog");
  assert.deepEqual((await readEditor()).draft.layouts.catalog, doc.layouts.catalog);
  await assert.rejects(changeHome(0, { kind: "publish" }, clock));
  const start = "2027-02-02T09:00", end = "2027-02-03T09:00";
  assert.equal(localTime(start), Date.parse("2027-02-02T05:00:00Z"));
  assert.ok(Number.isNaN(localTime("2027-02-31T02:00")));
  await assert.rejects(changeHome(rev, { kind: "schedule", start: end, end: start }, clock));
  rev = await changeHome(rev, { kind: "schedule", start, end }, clock);
  await assert.rejects(changeHome(rev, { kind: "schedule", start, end }, clock));
  rev = await changeHome(rev, { kind: "save", document: doc }, clock);
  const release = await readHomePublication();
  assert.equal(effectiveHome(release, localTime(start) - 1).preset, "catalog");
  assert.equal(effectiveHome(release, localTime(start)).preset, "guide");
  assert.equal(effectiveHome(release, localTime(end)).preset, "catalog");
  await assert.rejects(changeHome(rev, { kind: "publish" }, () => localTime(start)));
  rev = await changeHome(rev, { kind: "cancel" }, () => localTime(start));
  assert.equal((await readHomePublication()).schedule, null);
  rev = await changeHome(rev, { kind: "save", document: campaign }, clock);
  rev = await changeHome(rev, { kind: "schedule", start, end: "" }, clock);
  rev = await changeHome(rev, { kind: "save", document: doc }, () => localTime(end));
  assert.deepEqual((await readHomePublication()).published, campaign);
  const concurrent = await Promise.allSettled([1, 2].map(() => changeHome(rev, { kind: "publish" }, clock)));
  assert.equal(concurrent.filter(x => x.status === "fulfilled").length, 1);
  assert.equal((await readHomePublication()).published.preset, "catalog");
});

test("empty blocks, invisible products, real offer prices and scheduled fallbacks", async () => {
  const catalog: Catalog = JSON.parse(await readFile("data/catalog.json", "utf8"));
  const available = catalog.products.filter(p => p.visible);
  const doc = initialHome();
  doc.preset = "offer";
  doc.layouts.offer = ["offer", "popular", "catalog", "picks"];
  doc.picks.mode = "manual";
  doc.picks.ids = [available[1].id, "at-9999999"];
  assert.equal(homeSelection(doc, available, [], false).sections.filter(b => b.key === "picks").length, 1);
  const p = { ...available[0], price: { currency: "GEL" as const, base: 90, promo: 75 } };
  doc.offer.product = p.id;
  const view = homeSelection(doc, [p, ...available.slice(1)], [p.id], true);
  assert.equal(view.offer?.price.promo, 75);
  assert.deepEqual(view.picks.map(v => v.id), [available[1].id]);
  assert.equal(homeSelection(doc, [{ ...p, availability: { status: "out_of_stock" } }], [], true).offer, undefined);
  doc.offer.fallback = "hide";
  assert.equal(homeSelection(doc, available, [p.id], false).sections[0].key, "popular");
  assert.equal(inWindow("2027-02-01T12:00", "2027-02-01T12:30", localTime("2027-02-01T12:30")), false);
  assert.throws(() => parseHome({ ...doc, intro: { ...doc.intro, photo: "https://example.com/img.jpg" } }));
  assert.throws(() => parseHome({ ...doc, layouts: { ...doc.layouts, catalog: ["offer", "catalog"] } }));
});

test("30-day bestseller ranking excludes refunded, cancelled and other stores' orders", async () => {
  const db = await getDb();
  for (const [storeId, status, paymentStatus, productId, quantity, days] of [
    ["rodo", "confirmed", "paid", "at-1", 3, 1], ["rodo", "completed", "paid", "at-2", 4, 2],
    ["rodo", "completed", "refunded", "at-3", 10, 0], ["rodo", "cancelled", "paid", "at-4", 20, 0],
    ["standard", "confirmed", "paid", "at-5", 50, 1], ["rodo", "completed", "paid", "at-6", 99, 32],
  ] as const) {
    const [order] = await db.insert(orders).values({ storeId, status, paymentStatus, paymentMethod: "cash", customerName: "Test",
      customerPhone: "test", deliveryMethod: "pickup", subtotal: 100, total: 100, accessToken: "test" }).returning();
    await db.insert(orderItems).values({ orderId: order.id, productId, quantity, name: productId, slug: productId, unitPrice: 100, lineTotal: quantity * 100 });
    await db.insert(orderEvents).values({ orderId: order.id, type: "status", toStatus: "confirmed", actor: "admin", createdAt: new Date(Date.now() - days * 86400000) });
  }
  assert.deepEqual(await confirmedSales(), ["at-2", "at-1"]);
});
