import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { getDb } from "../../src/db";
import { homepageHistory, orderEvents, orderItems, orders, storeCatalogs, storeHomepages } from "../../src/db/schema";
import { initialHome, effectiveHome, localTime, inWindow } from "../../src/lib/homepage/model";
import { activatePermanentHome, changeHome, readEditor, readHomeHistory, readHomePublication } from "../../src/lib/homepage/service";
import { resolveHomePublication } from "../../src/lib/homepage/runtime";
import { parseHome } from "../../src/lib/homepage/validation";
import { homeSelection } from "../../src/lib/homepage/selection";
import { confirmedSales } from "../../src/lib/homepage/sales";
import { quotePublication } from "../../src/lib/orders/quote";
import type { Catalog } from "../../src/lib/catalog/types";

Object.assign(process.env, { DATABASE_URL: "pglite:memory", STORE_ID: "rodo", CATALOG_SOURCE: "file", CATALOG_PATH: "data/catalog.json" });
test("store defaults, optimistic edits, independent releases, end boundaries and permanent switches", async () => {
  const doc = initialHome();
  const campaign = { ...doc, preset: "guide" as const };
  const clock = () => localTime("2027-02-01T08:00");
  assert.deepEqual(await readHomePublication(), { published: doc, schedule: null });
  let rev = (await changeHome(0, { kind: "save", document: campaign }, clock)).revision;
  assert.equal((await readHomePublication()).published.preset, "catalog");
  assert.deepEqual((await readEditor()).draft.layouts.catalog, doc.layouts.catalog);
  await assert.rejects(changeHome(0, { kind: "publish" }, clock));
  const start = "2027-02-02T09:00", end = "2027-02-03T09:00";
  assert.equal(localTime(start), Date.parse("2027-02-02T05:00:00Z"));
  assert.ok(Number.isNaN(localTime("2027-02-31T02:00")));
  await assert.rejects(changeHome(rev, { kind: "schedule", start: end, end: start }, clock));
  rev = (await changeHome(rev, { kind: "schedule", start, end }, clock)).revision;
  await assert.rejects(changeHome(rev, { kind: "schedule", start, end }, clock));
  rev = (await changeHome(rev, { kind: "save", document: doc }, clock)).revision;
  const release = await readHomePublication();
  assert.equal(effectiveHome(release, localTime(start) - 1).preset, "catalog");
  assert.equal(effectiveHome(release, localTime(start)).preset, "guide");
  assert.equal(effectiveHome(release, localTime(end)).preset, "catalog");
  assert.equal((await readEditor(() => localTime(end))).schedule, null, "expired campaigns expose no cancellation action");
  assert.ok((await readHomePublication()).schedule, "editor reads do not mutate publication");
  rev = (await changeHome(rev, { kind: "publish" }, () => localTime(start))).revision;
  assert.equal(effectiveHome(await readHomePublication(), localTime(start)).preset, "guide");
  assert.equal(effectiveHome(await readHomePublication(), localTime(end)).preset, "catalog");
  rev = (await changeHome(rev, { kind: "cancel" }, () => localTime(start))).revision;
  assert.equal((await readHomePublication()).schedule, null);
  rev = (await changeHome(rev, { kind: "save", document: campaign }, clock)).revision;
  rev = (await changeHome(rev, { kind: "schedule", start, end: "" }, clock)).revision;
  const promotion = await changeHome(rev, { kind: "save", document: doc }, () => localTime(end));
  rev = promotion.revision;
  assert.equal(promotion.publicationChanged, true, "autosave must signal the release cache transition");
  assert.deepEqual((await readHomePublication()).published, campaign);
  const draftOnly = await changeHome(rev, { kind: "save", document: doc }, () => localTime(end));
  rev = draftOnly.revision;
  assert.equal(draftOnly.publicationChanged, false, "ordinary autosave needs no public refresh");
  const concurrent = await Promise.allSettled([1, 2].map(() => changeHome(rev, { kind: "publish" }, clock)));
  assert.equal(concurrent.filter(x => x.status === "fulfilled").length, 1);
  assert.equal((await readHomePublication()).published.preset, "catalog");
});

test("a permanent release activates once without an admin save and remains the base after catalog changes", async () => {
  const db = await getDb(), row = await readEditor();
  const candidate = { ...initialHome(), preset: "guide" as const };
  const start = "2027-04-02T10:00", before = () => localTime("2027-04-01T10:00"), after = () => localTime(start);
  let rev = (await changeHome(row.revision, { kind: "save", document: candidate }, before)).revision;
  rev = (await changeHome(rev, { kind: "schedule", start, end: "" }, before)).revision;
  const historyBefore = (await readHomeHistory(50)).filter(item => item.kind === "activate").length;
  const activated = await Promise.all([activatePermanentHome(after), activatePermanentHome(after)]);
  assert.ok(activated.every(value => value.schedule === null && value.published.preset === "guide"));
  const editor = await readEditor(after);
  assert.equal(editor.schedule, null, "the editor cannot offer cancellation of an already active base");
  assert.equal(editor.revision, rev + 1, "concurrent activation has one revision transition");
  assert.equal((await readHomeHistory(50)).filter(item => item.kind === "activate").length, historyBefore + 1);
  const [catalogRow] = await db.select().from(storeCatalogs).where(eq(storeCatalogs.storeId, "rodo"));
  try {
    await db.update(storeCatalogs).set({ published: { ...catalogRow.published, products: [] } }).where(eq(storeCatalogs.storeId, "rodo"));
    assert.deepEqual(await activatePermanentHome(after), { published: candidate, schedule: null },
      "later invalidation never resurrects the base that preceded this permanent release");
  } finally {
    await db.update(storeCatalogs).set({ published: catalogRow.published }).where(eq(storeCatalogs.storeId, "rodo"));
  }
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
    ["rodo", "confirmed", "unpaid", "at-7", 77, 1],
  ] as const) {
    const [order] = await db.insert(orders).values({ storeId, status, paymentStatus, paymentMethod: "cash", customerName: "Test",
      customerPhone: "test", deliveryMethod: "pickup", subtotal: 100, total: 100, accessToken: "test" }).returning();
    await db.insert(orderItems).values({ orderId: order.id, productId, quantity, name: productId, slug: productId, unitPrice: 100, lineTotal: quantity * 100 });
    await db.insert(orderEvents).values({ orderId: order.id, type: "status", toStatus: "confirmed", actor: "admin", createdAt: new Date(Date.now() - days * 86400000) });
  }
  assert.deepEqual(await confirmedSales(), ["at-2", "at-1"]);
});

test("history restoration is private, store-scoped and revision guarded", async () => {
  const before = await readEditor();
  const edited = { ...before.draft, intro: { ...before.draft.intro, title: "ისტორიის სატესტო სათაური" } };
  let rev = (await changeHome(before.revision, { kind: "save", document: edited })).revision;
  rev = (await changeHome(rev, { kind: "publish" })).revision;
  const published = await readHomePublication();
  const history = await readHomeHistory();
  assert.equal(history[0].kind, "publish");
  assert.equal(history[0].actor, "admin");
  const baseline = history.find(item => item.kind === "baseline");
  assert.ok(baseline);
  const unpublished = { ...edited, intro: { ...edited.intro, title: "აღდგენამდე დაუმთავრებელი სამუშაო" } };
  rev = (await changeHome(rev, { kind: "save", document: unpublished })).revision;
  rev = (await changeHome(rev, { kind: "restore", id: baseline.id })).revision;
  assert.deepEqual(await readHomePublication(), published, "restore must never publish");
  assert.deepEqual((await readEditor()).draft, baseline.document);
  await assert.rejects(changeHome(rev - 1, { kind: "publish" }), /სხვა ფანჯრიდან/);
  const checkpoint = (await readHomeHistory()).find(item => item.kind === "before_restore");
  assert.ok(checkpoint);
  assert.deepEqual(checkpoint.document, unpublished, "restore retains the previously unpublished draft");
  rev = (await changeHome(rev, { kind: "restore", id: checkpoint.id })).revision;
  assert.deepEqual((await readEditor()).draft, unpublished, "an accidental restore is itself reversible");
  assert.deepEqual(await readHomePublication(), published);
  const db = await getDb();
  await db.insert(storeHomepages).values({ storeId: "other-test-store", draft: initialHome(), published: initialHome() });
  const [foreign] = await db.insert(homepageHistory).values({ storeId: "other-test-store", revision: 1,
    kind: "publish", actor: "admin", document: edited, summary: [] }).returning();
  await assert.rejects(changeHome(rev, { kind: "restore", id: foreign.id }), /ვერ მოიძებნა/);
  const [persisted] = await db.select().from(storeHomepages).where(eq(storeHomepages.storeId, "rodo"));
  assert.equal(persisted.revision, rev, "failed restoration must be atomic");
});

test("a scheduled offer is rechecked against current prices and stock at activation", async () => {
  const catalog: Catalog = JSON.parse(await readFile("data/catalog.json", "utf8"));
  const product = catalog.products.find(p => p.visible && p.price.base !== null)!;
  const base = initialHome(), campaign = initialHome();
  campaign.preset = "offer";
  campaign.offer.product = product.id;
  const current = { ...catalog, products: [{ ...product, price: { currency: "GEL" as const, base: 100, promo: 80 } }] };
  const start = "2027-03-01T10:00", end = "2027-03-02T10:00";
  const publication = { published: base, schedule: { start, end, document: campaign } };
  assert.equal(resolveHomePublication(publication, current, localTime(start)).source, "campaign");
  assert.equal(resolveHomePublication({ ...publication, schedule: { ...publication.schedule, end: "" } }, current, localTime(start)).source, "base");
  const unavailable = { ...current, products: current.products.map(p => ({ ...p, availability: { status: "out_of_stock" as const } })) };
  assert.equal(resolveHomePublication(publication, unavailable, localTime(start)).blocked, true);
  assert.equal(resolveHomePublication(publication, unavailable, localTime(start)).document.preset, "catalog");
  const noDiscount = { ...current, products: current.products.map(p => ({ ...p, price: { ...p.price, promo: null } })) };
  assert.equal(resolveHomePublication(publication, noDiscount, localTime(start)).source, "base");
  const latestBase = { ...base, intro: { ...base.intro, title: "კამპანიის დროს განახლებული ძირითადი გვერდი" } };
  assert.equal(resolveHomePublication({ ...publication, published: latestBase }, current, localTime(end)).document.intro.title, latestBase.intro.title);
});

test("incomplete drafts persist but cannot be published", async () => {
  const row = await readEditor();
  const draft = { ...initialHome(), intro: { ...initialHome().intro, title: "" } };
  const rev = (await changeHome(row.revision, { kind: "save", document: draft })).revision;
  assert.equal((await readEditor()).draft.intro.title, "");
  await assert.rejects(changeHome(rev, { kind: "publish" }), /სათაური/);
  assert.equal((await readEditor()).revision, rev);
});

test("a formerly featured product with exhausted stock is rejected when the order is quoted", async () => {
  const catalog: Catalog = JSON.parse(await readFile("data/catalog.json", "utf8"));
  const product = catalog.products.find(p => p.visible && p.price.base !== null)!;
  const unavailable = { ...catalog, generated_at: "out-of-stock-test", products: [{ ...product, availability: { status: "out_of_stock" as const } }] };
  const quote = quotePublication([{ productId: product.id, qty: 1 }], unavailable);
  assert.equal(quote.lines.length, 0);
  assert.deepEqual(quote.problems, [{ productId: product.id, kind: "unavailable" }]);
});
