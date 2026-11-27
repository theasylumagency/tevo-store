import assert from "node:assert/strict";
import { test } from "node:test";
import source from "../data/catalog.json";
import type { Catalog, Product } from "../src/lib/catalog/types";
import { resolveChoiceProducts } from "../src/lib/choices/presentation";
import { cleanChoiceIds, comparisonHref } from "../src/lib/choices/types";

const catalog = source as unknown as Catalog;
const base = catalog.products.find((p) => p.visible)!;
const product = (id: string, overrides: Partial<Product> = {}): Product => ({ ...base, id, ...overrides });

test("saved lookup returns only current public facts, retaining unavailable identifiers separately", () => {
  const current = product("current", { name: "ახალი სახელი", price: { currency: "GEL", base: 900, promo: 800 }, availability: { status: "out_of_stock" } });
  const hidden = product("hidden", { visible: false, name: "PRIVATE DRAFT" });
  const result = resolveChoiceProducts(["hidden", "current", "missing", "current"], { ...catalog, products: [current, hidden] }, new Set());
  assert.deepEqual(result.missingIds, ["hidden", "missing"]);
  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].name, "ახალი სახელი");
  assert.deepEqual(result.products[0].price, current.price);
  assert.equal(result.products[0].availability, "out_of_stock");
  assert.equal(result.products[0].image, null);
  assert.ok(!JSON.stringify(result).includes("PRIVATE DRAFT"));
});

test("a later lookup reflects repricing and unpublication without trusting saved browser facts", () => {
  const published = product("selected");
  const first = resolveChoiceProducts(["selected"], { ...catalog, products: [published] }, new Set());
  assert.equal(first.products.length, 1);
  const repriced = { ...published, price: { currency: "GEL" as const, base: 123, promo: null } };
  assert.equal(resolveChoiceProducts(["selected"], { ...catalog, products: [repriced] }, new Set()).products[0].price.base, 123);
  assert.deepEqual(resolveChoiceProducts(["selected"], { ...catalog, products: [{ ...repriced, visible: false }] }, new Set()), { products: [], missingIds: ["selected"] });
});

test("projection keeps source units and false attributes but excludes provenance and review data", () => {
  const item = product("public", {
    specs: [{ key: "power_kw", label: "სიმძლავრე", value: "5.2", unit: "კვტ", source: "INTERNAL SOURCE" }],
    attributes: { electric_start: false, unknown_admin_field: "PRIVATE" },
    media: [{ file: "available.jpg", role: "main", position: 1, source_url: "https://internal.invalid" }],
  });
  const [projected] = resolveChoiceProducts(["public"], { ...catalog, products: [item] }, new Set(["available.jpg"])).products;
  assert.equal(projected.image, "/media/available.jpg");
  assert.equal(projected.specs[0].unit, "კვტ");
  assert.deepEqual(projected.attributes, [{ key: "electric_start", label: "ელექტრო სტარტერი", value: false }]);
  const serialized = JSON.stringify(projected);
  for (const privateValue of ["source", "INTERNAL", "PRIVATE", "data_quality", "relations"]) assert.ok(!serialized.includes(privateValue));
});

test("identifier parsing bounds shared URLs and cannot turn data into paths", () => {
  assert.deepEqual(cleanChoiceIds(null), []);
  assert.deepEqual(cleanChoiceIds(["at-1", "at-1", null, "../admin", "a b", "<script>", "A_2"]), ["at-1", "A_2"]);
  assert.equal(comparisonHref(["at-1", "at-2", "at-3", "at-4", "at-5"]), "/compare?ids=at-1,at-2,at-3,at-4");
  assert.equal(comparisonHref([]), "/compare");
  assert.deepEqual(resolveChoiceProducts({ price: 1, id: base.id }, catalog, new Set()), { products: [], missingIds: [] });
});
