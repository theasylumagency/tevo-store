import assert from "node:assert/strict";
import { test } from "node:test";
import catalogData from "../data/catalog.json";
import type { Catalog, Product } from "../src/lib/catalog/types";
import { productCompatibility, relatedProductReasons, relationDescriptions } from "../src/lib/catalog/compatibility";

const catalog = catalogData as unknown as Catalog;
const base = catalog.products[0];
const item = (id: string, extra: Partial<Product> = {}): Product => ({ ...base, id, slug: id, visible: true, compatibility: null, relations: [], ...extra });

test("compatibility preserves source dimensions/model and resolves broad type and brand labels", () => {
  const product = item("part", { compatibility: {
    product_types: ["MOTOBLOCK", "MOTOBLOCK", "FUTURE_TYPE"], brands: ["agri", "agri"],
    tire_size: " 4.00-8 ", engine_model: " 170F ", note: " არსებული შენიშვნა\nმეორე ხაზი ",
  } });
  const result = productCompatibility(product, catalog);
  assert.deepEqual(result.fields, [
    { key: "product_types", label: "პროდუქტის ტიპი", value: "მოტობლოკები · FUTURE_TYPE" },
    { key: "brands", label: "მითითებული ბრენდები", value: "AGRI" },
    { key: "tire_size", label: "საბურავის ზომა", value: "4.00-8" },
    { key: "engine_model", label: "ძრავის მოდელი", value: "170F" },
  ]);
  assert.equal(result.note, "არსებული შენიშვნა\nმეორე ხაზი");
  assert.equal(result.fitCount, 0, "A matching type, brand or engine must not manufacture model relations");
});

test("compatibility links include only explicit visible targets and preserve source reasons", () => {
  const product = item("part", { relations: [
    { type: "fits", product_id: "model", reason: "მითითებული ზომა 4.00-8" },
    { type: "fits", product_id: "model", reason: "duplicate" },
    { type: "fits", product_id: "hidden" },
    { type: "fits", product_id: "missing" },
    { type: "fits", product_id: "part" },
    { type: "same_size", product_id: "size" },
    { type: "variant", product_id: "variant" },
  ] });
  const products = [product, item("model", { name: "ზუსტი მოდელი", slug: "exact-model" }), item("hidden", { visible: false }), item("size"), item("variant")];
  assert.deepEqual(productCompatibility(product, { ...catalog, products }).fits, [
    { id: "model", name: "ზუსტი მოდელი", href: "/p/exact-model", reason: "მითითებული ზომა 4.00-8" },
  ]);
  assert.equal(relatedProductReasons(product, "same_size", products)[0].id, "size");
  assert.equal(relatedProductReasons(product, "variant", products)[0].id, "variant");
});

test("same size and variants never produce fits claims or infer reverse links", () => {
  const product = item("component", { product_type: "SPARE_PART", relations: [
    { type: "same_size", product_id: "size", reason: "ერთნაირი ზომა" },
    { type: "variant", product_id: "variant" },
  ] });
  const reverse = item("reverse", { relations: [{ type: "fits", product_id: product.id }] });
  const result = productCompatibility(product, { ...catalog, products: [product, item("size"), item("variant"), reverse] });
  assert.equal(result.hasEvidence, false);
  assert.equal(result.show, true, "A part without model evidence still needs useful guidance");
  assert.deepEqual(result.fits, []);
  assert.match(relationDescriptions.same_size, /სრული თავსებადობის დადასტურება არ არის/);
  assert.match(relationDescriptions.variant, /პირდაპირ შემცვლელად არ მიიჩნევა/);
});

test("unknown compatibility shows guidance for components without adding warnings to unrelated equipment", () => {
  assert.equal(productCompatibility(item("part", { product_type: "SPARE_PART" }), catalog).show, true);
  assert.equal(productCompatibility(item("tire", { product_type: "TIRE", compatibility: { brands: null, product_types: [], note: " " } }), catalog).hasEvidence, false);
  assert.equal(productCompatibility(item("machine", { product_type: "MOTOBLOCK" }), catalog).show, false);
  const malformed = { product_types: "MOTOBLOCK", brands: ["agri", null, ""], tire_size: 4, engine_model: {} } as unknown as Product["compatibility"];
  assert.deepEqual(productCompatibility(item("part", { compatibility: malformed }), catalog).fields, [
    { key: "brands", label: "მითითებული ბრენდები", value: "AGRI" },
  ]);
});

test("compatibility preview bounds model links while retaining the actual visible count", () => {
  const products = Array.from({ length: 7 }, (_, index) => item(`model-${index}`));
  const product = item("part", { relations: products.map((target) => ({ type: "fits", product_id: target.id })) });
  const result = productCompatibility(product, { ...catalog, products });
  assert.equal(result.fits.length, 4);
  assert.equal(result.fitCount, 7);
});
