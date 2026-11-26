import assert from "node:assert/strict";
import { test } from "node:test";
import { parseQuery, type ListingQuery } from "../src/lib/catalog/filters";
import { activeFilterCount, countFacetOptions, listingHref, matchesFacetRecord, readPriceRange, withoutFilters, type FacetRecord } from "../src/lib/catalog/filter-state";

const records: FacetRecord[] = [
  { id: "a", price: 500, values: { brand: ["AGRI"], fuel: ["ბენზინი"] } },
  { id: "b", price: 1000, values: { brand: ["AGRI"], fuel: ["დიზელი"] } },
  { id: "c", price: 700, values: { brand: ["HIROMIKI"], fuel: ["ბენზინი"] } },
  { id: "d", price: null, values: { brand: ["HIROMIKI"], fuel: ["დიზელი"] } },
];
const query: ListingQuery = { filters: {}, sort: "default" };

test("price entry accepts Georgian decimal habits and rejects invalid/reversed ranges", () => {
  assert.deepEqual(readPriceRange("1 000,50", "1500"), { valid: true, from: 1000.5, to: 1500 });
  assert.deepEqual(readPriceRange("0", ""), { valid: true, from: 0, to: undefined });
  assert.deepEqual(readPriceRange("-1", "500"), { valid: false, reason: "number" });
  assert.deepEqual(readPriceRange("Infinity", "500"), { valid: false, reason: "number" });
  assert.deepEqual(readPriceRange("1000", "500"), { valid: false, reason: "order" });
});

test("reset preserves the customer's search, explicit correction preference and sort", () => {
  const before: ListingQuery = { filters: { brand: ["AGRI"], fuel: ["ბენზინი"] }, q: "hiromki", exact: true, sort: "price_desc", priceFrom: 0, priceTo: 800 };
  const reset = withoutFilters(before);
  const url = new URL(listingHref("/search", reset), "https://example.test");
  assert.equal(url.searchParams.get("q"), "hiromki");
  assert.equal(url.searchParams.get("exact"), "1");
  assert.equal(url.searchParams.get("sort"), "price_desc");
  assert.equal(url.searchParams.has("brand"), false);
  assert.equal(url.searchParams.has("price_from"), false);
  assert.equal(activeFilterCount(reset), 0);
});

test("a shared filter URL round-trips zero, multiple choices and Georgian text", () => {
  const before: ListingQuery = { ...query, q: "მოტობლოკი", filters: { brand: ["HIROMIKI", "AGRI"], fuel: ["ბენზინი"] }, priceFrom: 0 };
  const url = new URL(listingHref("/search", before), "https://example.test");
  const restored = parseQuery(Object.fromEntries(url.searchParams), {
    attribute_vocabulary: { fuel: { label: "საწვავი", type: "enum", values: ["ბენზინი", "დიზელი"] } }, spec_vocabulary: [],
  });
  assert.equal(restored.priceFrom, 0);
  assert.equal(restored.q, "მოტობლოკი");
  assert.deepEqual(restored.filters.brand, ["AGRI", "HIROMIKI"]);
  assert.deepEqual(restored.filters.fuel, ["ბენზინი"]);
});

test("draft result counts OR alternatives in one facet and AND different facets", () => {
  const draft = { ...query, filters: { brand: ["AGRI", "HIROMIKI"], fuel: ["ბენზინი"] }, priceTo: 600 };
  assert.deepEqual(records.filter((record) => matchesFacetRecord(record, draft)).map((record) => record.id), ["a"]);
});

test("counts let a customer broaden a selected facet without losing other constraints", () => {
  const draft = { ...query, filters: { brand: ["AGRI"], fuel: ["ბენზინი"] } };
  assert.deepEqual(Object.fromEntries(countFacetOptions(records, draft, "brand")), { AGRI: 1, HIROMIKI: 1 });
  assert.deepEqual(Object.fromEntries(countFacetOptions(records, draft, "fuel")), { "ბენზინი": 1, "დიზელი": 1 });
});

test("type counts discard old technical constraints but retain brand and price", () => {
  const typedRecords: FacetRecord[] = [
    { id: "machine", price: 500, values: { type: ["MOTOBLOCK"], brand: ["AGRI"], power_hp: ["7"] } },
    { id: "tire", price: 100, values: { type: ["TIRE"], brand: ["AGRI"] } },
    { id: "different-brand", price: 100, values: { type: ["TIRE"], brand: ["HIROMIKI"] } },
    { id: "expensive", price: 900, values: { type: ["TIRE"], brand: ["AGRI"] } },
    { id: "unknown-price", price: null, values: { type: ["TIRE"], brand: ["AGRI"] } },
  ];
  const before: ListingQuery = { ...query, filters: { type: ["MOTOBLOCK"], power_hp: ["7"], brand: ["AGRI"] }, priceTo: 800 };
  assert.deepEqual(Object.fromEntries(countFacetOptions(typedRecords, before, "type")), { MOTOBLOCK: 1, TIRE: 1 });
  const switched: ListingQuery = { ...before, filters: { type: ["TIRE"], brand: ["AGRI"] } };
  assert.deepEqual(typedRecords.filter((record) => matchesFacetRecord(record, switched)).map((record) => record.id), ["tire"]);
});

test("a missing price is never treated as free or included within a numeric price bound", () => {
  assert.equal(matchesFacetRecord(records[3], query), true);
  assert.equal(matchesFacetRecord(records[3], { ...query, priceTo: 100 }), false);
  assert.equal(matchesFacetRecord(records[3], { ...query, priceFrom: 0 }), false);
});
