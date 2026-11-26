import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Catalog, Product } from "../src/lib/catalog/types";
import { createSearchIndex, searchCatalog } from "../src/lib/catalog/search";
import { applyQuery, buildFacets, facetValues, getSearchResult, parseQuery } from "../src/lib/catalog/filters";

const realCatalog = JSON.parse(readFileSync(new URL("../data/catalog.json", import.meta.url), "utf8")) as Catalog;
const realIndex = createSearchIndex(realCatalog);

function product(id: string, change: Partial<Product> = {}): Product {
  return {
    id, slug: id, legacy_wp_id: null, name: `მოტობლოკი ${id}`, subtitle: null, name_legacy: null,
    product_type: "MOTOBLOCK", category: "AGRI", brand: "hiromiki", model: null, variant_group: null,
    price: { currency: "GEL", base: 100, promo: null }, availability: { status: "in_stock" }, visible: true,
    attributes: {}, specs: [], features: [], description: "", compatibility: null, relations: [], media: [],
    videos: [], codes: {}, data_quality: { score: 100, issues: [] }, ...change,
  };
}

function catalog(products: Product[]): Catalog {
  return {
    schema_version: "1", generated_at: "2026-11-26", source: { kind: "test" },
    categories: [{ id: "AGRI", name: "სასოფლო-სამეურნეო ტექნიკა", position: 1, product_types: ["MOTOBLOCK", "TIRE"] }],
    product_types: [
      { id: "MOTOBLOCK", name: "მოტობლოკი", name_plural: "მოტობლოკები", category: "AGRI", facets: ["brand", "power_hp", "price"] },
      { id: "TIRE", name: "საბურავი", name_plural: "საბურავები", category: "AGRI", facets: ["price"] },
    ],
    brands: [{ id: "hiromiki", name: "Hiromiki", name_ka: "ჰირომიკი" }], attribute_vocabulary: {}, quality_issue_labels: {},
    spec_vocabulary: [{ key: "power_hp", label: "სიმძლავრე", unit: "ცხ.ძ.", group: "engine" }], products,
  };
}

test("public index is serializable and excludes hidden products and review data", () => {
  const data = catalog([product("visible"), product("hidden", { visible: false })]);
  const index = createSearchIndex(data);
  assert.equal(index.products.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(index)), index);
  assert.ok(!JSON.stringify(index).includes("data_quality"));
  assert.ok(!JSON.stringify(index).includes("legacy_wp_id"));
});

test("Georgian, Latin transliteration and wrong keyboard layout find the same category", () => {
  const ka = searchCatalog(realIndex, "შესხურება");
  const latin = searchCatalog(realIndex, "sheskhureba");
  const keyboard = searchCatalog(realIndex, "Sesxureba");
  const ids = (result: typeof ka) => result.products.map(({ item }) => item.id).sort();
  assert.ok(ka.total > 0);
  assert.deepEqual(ids(latin), ids(ka));
  assert.deepEqual(ids(keyboard), ids(ka));
  assert.equal(keyboard.correction, null);
});

test("type aliases find the full product type and produce category/type suggestions", () => {
  const index = createSearchIndex(catalog([product("machine"), product("tire", { name: "საბურავი", product_type: "TIRE" })]));
  const result = searchCatalog(index, "კულტივატორი");
  assert.deepEqual(result.products.map(({ item }) => item.id), ["machine"]);
  assert.equal(result.types[0]?.id, "MOTOBLOCK");
  assert.equal(result.categories[0]?.id, "AGRI");
});

test("bounded typo correction is explicit and exact mode preserves the original search", () => {
  const corrected = searchCatalog(realIndex, "hiromki");
  assert.ok(corrected.total > 0);
  assert.equal(corrected.correction?.toLowerCase(), "hiromiki");
  assert.ok(corrected.products.every(({ item, match }) => item.brandId === "hiromiki" && match === "fuzzy"));
  assert.equal(searchCatalog(realIndex, "hiromki", { exact: true }).total, 0);
  assert.equal(searchCatalog(realIndex, "მოტობლკი").correction, "მოტობლოკი");
});

test("transposed adjacent letters can be corrected without guessing unrelated words", () => {
  assert.equal(searchCatalog(realIndex, "hiromkii").correction?.toLowerCase(), "hiromiki");
  assert.equal(searchCatalog(realIndex, "zxqvtrzz").total, 0);
  assert.equal(searchCatalog(realIndex, "zxqvtrzz").correction, null);
});

test("models, numeric tokens and alphabetic codes are never fuzzy corrected", () => {
  const index = createSearchIndex(catalog([
    product("first", { model: "170F", codes: { supplier: "AG-170F" } }),
    product("second", { model: "177F" }),
    product("third", { model: "170P" }),
    product("fourth", { model: "TRONIC", name: "მოტობლოკი TRONIC" }),
  ]));
  assert.deepEqual(searchCatalog(index, "170F").products.map(({ item }) => item.id), ["first"]);
  assert.equal(searchCatalog(index, "171F").total, 0);
  assert.equal(searchCatalog(index, "171").total, 0);
  assert.equal(searchCatalog(index, "TRONCI").total, 0);
  assert.equal(searchCatalog(index, "hiromki 171F").correction, null);
  assert.deepEqual(searchCatalog(index, "170ფ").products.map(({ item }) => item.id), ["first"]);
});

test("a valid number is preserved while a word typo in the same query is corrected", () => {
  const result = searchCatalog(realIndex, "hiromki 170F");
  assert.ok(result.total > 0);
  assert.match(result.correction ?? "", /170F$/);
  assert.ok(result.products.every(({ item }) => item.model === "170F" && item.brandId === "hiromiki"));
});

test("numeric dimensions retain their separators and are not conflated", () => {
  const index = createSearchIndex(catalog([
    product("standard", { product_type: "TIRE", name: "საბურავი 4.00-8" }),
    product("different", { product_type: "TIRE", name: "საბურავი 4.0-08" }),
  ]));
  assert.deepEqual(searchCatalog(index, "4.00-8").products.map(({ item }) => item.id), ["standard"]);
  assert.deepEqual(searchCatalog(index, "4.0-08").products.map(({ item }) => item.id), ["different"]);
  assert.equal(searchCatalog(index, "4.00-9").total, 0);
});

test("exact models rank ahead of model mentions and tolerate separators", () => {
  const index = createSearchIndex(catalog([
    product("accessory", { product_type: "TIRE", name: "საბურავი", subtitle: "ერგება AG-170F მოდელს" }),
    product("machine", { model: "AG-170F" }),
  ]));
  assert.equal(searchCatalog(index, "AG-170F").products[0]?.item.id, "machine");
  assert.equal(searchCatalog(index, "AG 170F").products[0]?.item.id, "machine");
  assert.equal(searchCatalog(index, "AG170F").products[0]?.item.id, "machine");
});

test("literal model prefix completion preserves every entered numeric group", () => {
  const index = createSearchIndex(catalog([
    product("exact", { model: "MQ170" }),
    product("suffix", { model: "MQ170GS" }),
    product("variant", { model: "MQ170-4" }),
    product("extra-digit", { model: "MQ1700" }),
    product("different-number", { model: "MQ171GS" }),
  ]));
  const result = searchCatalog(index, "MQ170");
  assert.equal(result.products[0]?.item.id, "exact");
  assert.deepEqual(result.products.map(({ item }) => item.id).sort(), ["exact", "suffix", "variant"]);
  assert.equal(result.products.find(({ item }) => item.id === "suffix")?.match, "prefix");
  assert.equal(result.correction, null);
  assert.equal(searchCatalog(index, "MQ17").total, 0);
  assert.equal(searchCatalog(index, "MQ170GZ").total, 0);
  assert.equal(searchCatalog(index, "MQ172").total, 0);
});

test("result limit does not change the total and short empty queries do not guess", () => {
  const result = searchCatalog(realIndex, "მოტობლოკი", { limit: 3 });
  assert.equal(result.products.length, 3);
  assert.ok(result.total > 3);
  assert.equal(searchCatalog(realIndex, "").total, 0);
  assert.equal(searchCatalog(realIndex, "!!!").total, 0);
  assert.equal(searchCatalog(realIndex, "z".repeat(201)).total, 0);
});

test("query parser keeps exact separate from facets and rejects invalid prices", () => {
  const query = parseQuery({ q: " hiromki ", exact: "1", type: "MOTOBLOCK", price_from: "Infinity", price_to: "-1" });
  assert.equal(query.q, "hiromki");
  assert.equal(query.exact, true);
  assert.deepEqual(query.filters, { type: ["MOTOBLOCK"] });
  assert.equal(query.priceFrom, undefined);
  assert.equal(query.priceTo, undefined);
});

test("marketing and arbitrary URL parameters never act as catalog filters", () => {
  const input = { q: "მოტობლოკი", power_hp: "7", utm_source: "facebook", utm_campaign: "spring", gclid: "click-id", fbclid: "social-click", made_up: "value" };
  const parsed = parseQuery(input, realCatalog);
  assert.deepEqual(parsed.filters, { power_hp: ["7"] });
  assert.deepEqual(applyQuery(realCatalog.products, parsed, realCatalog).map((p) => p.id),
    applyQuery(realCatalog.products, parseQuery({ q: input.q, power_hp: "7" }, realCatalog), realCatalog).map((p) => p.id));
  assert.ok(applyQuery(realCatalog.products, parsed, realCatalog).length > 0);
  assert.deepEqual(parseQuery({ brand: "hiromiki", type: "MOTOBLOCK", utm_source: "facebook" }).filters,
    { brand: ["hiromiki"], type: ["MOTOBLOCK"] });
});

test("a uniquely matched product type exposes technical facets without explicit type selection", () => {
  const query = parseQuery({ q: "hiromki" }, realCatalog);
  const result = getSearchResult(realCatalog.products, query, realCatalog);
  assert.deepEqual([...new Set(result.products.map(({ item }) => item.typeId))], ["MOTOBLOCK"]);
  const facets = buildFacets(realCatalog.products, [], query, realCatalog, new Map(realCatalog.brands.map((brand) => [brand.id, brand.name])));
  assert.ok(facets.some((facet) => facet.key === "power_hp"));
  assert.ok(facets.some((facet) => facet.key === "fuel_type"));
});

test("filter results and facet counts use the same corrected search", () => {
  const data = catalog([product("one"), product("two", { brand: null })]);
  const query = parseQuery({ q: "hiromki" });
  assert.deepEqual(applyQuery(data.products, query, data).map((p) => p.id), ["one"]);
  assert.equal(getSearchResult(data.products, query, data).correction, "Hiromiki");
  assert.equal(getSearchResult(data.products, { ...query, exact: true }, data).total, 0);
});

test("selected type exposes technical facets without disabling a valid switch to another type", () => {
  const data = catalog([
    product("one", { specs: [{ key: "power_hp", label: "სიმძლავრე", value: "7", num: 7 }] }),
    product("two", { specs: [{ key: "power_hp", label: "სიმძლავრე", value: "9", num: 9 }] }),
    product("three", { product_type: "TIRE", name: "საბურავი" }),
  ]);
  const query = parseQuery({ type: "MOTOBLOCK", power_hp: "7" }, data);
  const facets = buildFacets(data.products, [], query, data, new Map([["hiromiki", "Hiromiki"]]));
  assert.deepEqual(facetValues(data.products[0], "type"), ["MOTOBLOCK"]);
  assert.ok(facets.some((facet) => facet.key === "power_hp"));
  assert.equal(facets.find((facet) => facet.key === "type")?.options.find((option) => option.value === "TIRE")?.count, 1);
  assert.deepEqual(applyQuery(data.products, query, data).map((p) => p.id), ["one"]);
  assert.deepEqual(applyQuery(data.products, { ...query, filters: { type: ["TIRE"] } }, data).map((p) => p.id), ["three"]);
});

test("unknown prices are excluded by bounds and sort last in both directions", () => {
  const data = catalog([
    product("unknown", { price: { base: null, promo: null, currency: "GEL" } }),
    product("cheap", { price: { base: 10, promo: null, currency: "GEL" } }),
    product("expensive", { price: { base: 20, promo: null, currency: "GEL" } }),
  ]);
  assert.deepEqual(applyQuery(data.products, parseQuery({ sort: "price_asc" }), data).map((p) => p.id), ["cheap", "expensive", "unknown"]);
  assert.deepEqual(applyQuery(data.products, parseQuery({ sort: "price_desc" }), data).map((p) => p.id), ["expensive", "cheap", "unknown"]);
  assert.deepEqual(applyQuery(data.products, parseQuery({ price_to: "15" }), data).map((p) => p.id), ["cheap"]);
  const facets = buildFacets(data.products, [], parseQuery({ price_from: "1000" }), data, new Map());
  assert.ok(facets.some((facet) => facet.key === "price"));
});
