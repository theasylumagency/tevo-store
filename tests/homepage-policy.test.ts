import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { Catalog, Product } from "../src/lib/catalog/types";
import { initialHome, localTime, normalizeHome, type HomeCollection, type HomeTarget } from "../src/lib/homepage/model";
import { parseHome } from "../src/lib/homepage/validation";
import { featuredCategories, genuineOffer, homeEligible, homeSelection, resolveHomeTarget, selectCollection } from "../src/lib/homepage/selection";
import { assessHome, summarizeHomeChanges } from "../src/lib/homepage/policy";

const source: Catalog = JSON.parse(readFileSync("data/catalog.json", "utf8"));
const sample = source.products.find(p => p.product_type === "MOTOBLOCK")!;
function product(id: number, patch: Partial<Product> = {}): Product {
  return { ...sample, id: `at-${id}`, slug: `fixture-${id}`, visible: true,
    price: { currency: "GEL", base: 100, promo: null }, availability: { status: "confirm_with_store" }, ...patch };
}
function catalog(products: Product[]): Catalog { return { ...source, products }; }
function collection(patch: Partial<HomeCollection> = {}): HomeCollection { return { ...initialHome().picks, ...patch }; }

test("older persisted homepage content survives additive policy defaults", () => {
  const original = initialHome();
  original.intro.title = "არსებული გვერდი";
  original.picks.ids = ["at-1", "at-2"];
  const old = JSON.parse(JSON.stringify(original));
  for (const key of ["seasonal", "categoryIds", "advice", "service"]) delete old[key];
  for (const key of ["intro", "offer"]) for (const field of ["mobilePhoto", "focalX", "focalY", "target"]) delete old[key][field];
  for (const field of ["sort", "limit", "onlyInStock"]) delete old.picks[field];
  const parsed = parseHome(old);
  assert.equal(parsed.intro.title, original.intro.title);
  assert.deepEqual(parsed.picks.ids, ["at-1", "at-2"]);
  assert.deepEqual(parsed.layouts, original.layouts);
  assert.equal(parsed.picks.onlyInStock, false);
  assert.equal(parsed.seasonal.limit, 4);
  assert.equal(parsed.intro.focalX, 50);
  assert.deepEqual(summarizeHomeChanges(normalizeHome(old), parsed), []);
});

test("draft validation preserves unfinished copy while rejecting unsafe structure and targets", () => {
  const doc = initialHome();
  doc.intro.title = "";
  doc.advice.title = "";
  assert.equal(parseHome(doc).intro.title, "");
  assert.throws(() => parseHome({ ...doc, intro: null }));
  assert.throws(() => parseHome({ ...doc, intro: { ...doc.intro, photo: "https://example.com/tracker.png" } }));
  assert.throws(() => parseHome({ ...doc, intro: { ...doc.intro, photo: "homepage/../secret.webp" } }));
  assert.throws(() => parseHome({ ...doc, intro: { ...doc.intro, target: { kind: "product", value: "javascript:alert(1)", label: "test" } } }));
  assert.throws(() => parseHome({ ...doc, layouts: { ...doc.layouts, catalog: ["catalog", "catalog"] } }));
  assert.throws(() => parseHome({ ...doc, layouts: { ...doc.layouts, guide: ["guide", "picks"] } }));
  assert.throws(() => parseHome({ ...doc, layouts: { ...doc.layouts, catalog: ["offer", "catalog"] } }));
  assert.throws(() => parseHome({ ...doc, intro: { ...doc.intro, photo: "homepage/1234-abcd.webp" } }));
  const uploaded = "homepage/8e9fbf07-2301-4dc1-a49e-0e5b1eab5a10.webp";
  assert.equal(parseHome({ ...doc, intro: { ...doc.intro, photo: uploaded } }).intro.photo, uploaded);
});

test("unknown availability remains explicit eligibility; known unavailable and unpriced offers are excluded", () => {
  const unknown = product(1), stock = product(2, { availability: { status: "in_stock" } });
  const out = product(3, { availability: { status: "out_of_stock" } });
  const invisible = product(4, { visible: false });
  const unpriced = product(5, { price: { currency: "GEL", base: null, promo: null } });
  const products = [unknown, stock, out, invisible, unpriced];
  assert.equal(homeEligible(unknown), true);
  assert.equal(homeEligible(out), false);
  assert.deepEqual(selectCollection(collection(), products).map(p => p.id), [unknown.id, stock.id]);
  assert.deepEqual(selectCollection(collection({ onlyInStock: true }), products).map(p => p.id), [stock.id]);
  const manual = collection({ mode: "manual", ids: [out.id, stock.id, unknown.id, "at-999"], sort: "price_asc" });
  assert.deepEqual(selectCollection(manual, products).map(p => p.id), [stock.id, unknown.id]);
  assert.deepEqual(selectCollection(collection({ mode: "manual", ids: [out.id] }), products), []);
});

test("automatic collections replenish within rules and real discount eligibility", () => {
  const p1 = product(1, { price: { currency: "GEL", base: 120, promo: 90 } });
  const p2 = product(2, { price: { currency: "GEL", base: 50, promo: null } });
  const p3 = product(3, { product_type: "WATER_PUMP", price: { currency: "GEL", base: 10, promo: 5 } });
  assert.deepEqual(selectCollection(collection({ sort: "price_asc" }), [p1, p2, p3]).map(p => p.id), [p2.id, p1.id]);
  assert.deepEqual(selectCollection(collection({ sort: "offers" }), [p1, p2, p3]).map(p => p.id), [p1.id]);
  assert.equal(genuineOffer(product(4, { price: { currency: "GEL", base: 50, promo: 50 } })), false);
  assert.equal(genuineOffer(product(5, { price: { currency: "GEL", base: 50, promo: 0 } })), false);
});

test("empty sections disappear and bestseller fallback never duplicates the editorial collection", () => {
  const doc = initialHome();
  doc.layouts.catalog = ["catalog", "popular", "picks", "seasonal", "guide"];
  doc.guide.tasks = [];
  const view = homeSelection(doc, [product(1)], [], true);
  assert.deepEqual(view.sections, [{ key: "catalog", fallback: false }, { key: "picks", fallback: true }]);
  const empty = homeSelection(doc, [product(1, { availability: { status: "out_of_stock" } })], [], true);
  assert.deepEqual(empty.sections, [{ key: "catalog", fallback: false }]);
});

test("featured categories preserve chosen order and internal targets resolve only to available catalog entities", () => {
  const categories = [{ id: "A" }, { id: "B" }, { id: "C" }];
  assert.deepEqual(featuredCategories(["C", "A", "MISSING"], categories), [{ id: "C" }, { id: "A" }]);
  assert.deepEqual(featuredCategories([], categories), categories);
  const p = product(1), c = catalog([p]);
  const target = (kind: HomeTarget["kind"], value: string): HomeTarget => ({ kind, value, label: "ნახვა" });
  assert.equal(resolveHomeTarget(target("catalog", ""), c), "/search");
  assert.equal(resolveHomeTarget(target("product", p.id), c), "/p/fixture-1");
  assert.ok(resolveHomeTarget(target("type", p.product_type), c)?.includes("motoblock"));
  assert.equal(resolveHomeTarget(target("product", "at-999"), c), null);
  assert.equal(resolveHomeTarget(target("product", p.id), catalog([{ ...p, visible: false }])), null);
  assert.equal(resolveHomeTarget(target("category", "MISSING"), c), null);
});

test("publication checks active promises while inactive unfinished content remains a safe draft", () => {
  const doc = initialHome(), c = catalog([product(1)]);
  doc.advice.title = "";
  assert.deepEqual(assessHome(doc, c).errors, []);
  doc.intro.title = "";
  assert.ok(assessHome(doc, c).errors.some(e => e.block === "intro"));
  doc.intro.title = "მთავარი გვერდი";
  doc.intro.target = { kind: "product", value: "at-999", label: "ნახვა" };
  assert.ok(assessHome(doc, c).errors.some(e => e.code === "unavailable_target"));
  doc.intro.target.kind = "none";
  doc.layouts.catalog.push("advice");
  assert.ok(assessHome(doc, c).errors.some(e => e.code === "missing_target"));
  doc.layouts.catalog = ["catalog", "picks", "seasonal"];
  const diagnosis = assessHome(doc, c, { media: [] });
  assert.deepEqual(diagnosis.errors, []);
  assert.ok(diagnosis.warnings.some(e => e.code === "stock_unconfirmed"));
  assert.ok(diagnosis.warnings.some(e => e.code === "empty_collection"));
});

test("offer and guide primary layouts are blocked when their commercial premise no longer holds", () => {
  const doc = initialHome();
  doc.preset = "offer";
  doc.offer.product = "at-1";
  doc.offer.start = "2027-02-01T09:00";
  doc.offer.end = "2027-02-02T09:00";
  const c = catalog([product(1, { price: { currency: "GEL", base: 100, promo: 80 } })]);
  assert.deepEqual(assessHome(doc, c, { now: localTime("2027-02-01T12:00") }).errors, []);
  assert.ok(assessHome(doc, c, { now: localTime("2027-02-02T09:00") }).errors.some(e => e.code === "offer_unavailable"));
  assert.ok(assessHome(doc, catalog([product(1)]), { now: localTime("2027-02-01T12:00") }).errors.some(e => e.code === "offer_unavailable"));
  doc.preset = "guide";
  doc.guide.tasks = [{ title: "მორწყვა", text: "", type: "MISSING" }];
  assert.ok(assessHome(doc, c).errors.some(e => e.code === "empty_guide"));
});

test("an unfinished guide destination autosaves but cannot become the primary published guide", () => {
  const doc = initialHome();
  doc.preset = "guide";
  doc.guide.tasks = [{ title: "ნიადაგის დამუშავება", text: "", type: "" }];
  const draft = parseHome(doc);
  assert.equal(draft.guide.tasks[0].type, "");
  assert.ok(assessHome(draft, catalog([product(1)])).errors.some(e => e.code === "empty_guide"));
});
