import assert from "node:assert/strict";
import { test } from "node:test";
import catalogData from "../data/catalog.json";
import type { Catalog, Product, Spec } from "../src/lib/catalog/types";
import { formatSpec, groupProductSpecs, productHighlights, productImages, productQuantity } from "../src/lib/catalog/product-presentation";

const vocabulary = catalogData as unknown as Catalog;
const product: Product = vocabulary.products[0];
const spec = (key: string, value: string, unit?: string): Spec => ({ key, label: key, value, unit });

test("product highlights use source facts without inventing specs or repeating power units", () => {
  const item = { ...product, product_type: "MOTOBLOCK", specs: [
    spec("model", "170F"), spec("power_kw", "5.2", "kW"), spec("power_hp", "7", "HP"),
    spec("working_width_cm", "80", "cm"), spec("weight_kg", "90", "kg"),
  ] };
  assert.deepEqual(productHighlights(item).map((value) => value.key), ["power_hp", "working_width_cm"]);
  assert.deepEqual(productHighlights(item, 4).map((value) => value.key), ["power_hp", "working_width_cm", "weight_kg"]);
  assert.deepEqual(productHighlights({ ...product, specs: [spec("model", "170F"), spec("power_hp", " ")] }), []);
  assert.deepEqual(productHighlights({ ...product, product_type: "NEW_TYPE", specs: [spec("custom_fact", "12", "mm")] }), [spec("custom_fact", "12", "mm")]);
});

test("spec groups keep unknown vocabulary facts visible and missing specs explicit", () => {
  const item = { specs: [spec("model", "170F"), spec("unknown", "42"), spec("new_group", "8"), spec("blank", " ")] };
  const groups = groupProductSpecs(item, { spec_vocabulary: [{ key: "new_group", label: "new", group: "future", unit: null }] });
  assert.deepEqual(groups, [{ key: "other", specs: [spec("unknown", "42"), spec("new_group", "8")] }]);
  assert.deepEqual(groupProductSpecs({ specs: [spec("model", "170F")] }, vocabulary), []);
});

test("spec formatting never duplicates an existing trailing unit", () => {
  assert.equal(formatSpec(spec("weight", " 7 kg ", "kg")), "7 kg");
  assert.equal(formatSpec(spec("weight", "7", "kg")), "7 kg");
  assert.equal(formatSpec(spec("weight", "7")), "7");
});

test("gallery media picks the available main image first and deduplicates without mutating the catalog", () => {
  const media = [
    { file: "other.jpg", role: "gallery" as const, position: 2 },
    { file: "missing.jpg", role: "main" as const, position: 0 },
    { file: "main.jpg", role: "main" as const, position: 3 },
    { file: "other.jpg", role: "gallery" as const, position: 4 },
  ];
  assert.deepEqual(productImages(media, new Set(["main.jpg", "other.jpg"])), [{ src: "/media/main.jpg" }, { src: "/media/other.jpg" }]);
  assert.equal(media[0].file, "other.jpg");
  assert.deepEqual(productImages(media, new Set()), []);
});

test("product additions respect remaining line capacity and whole-number entry", () => {
  assert.equal(productQuantity("20", 3), 3);
  assert.equal(productQuantity("2.9", 20), 2);
  assert.equal(productQuantity("", 20), 1);
  assert.equal(productQuantity("NaN", 20), 1);
  assert.equal(productQuantity("-4", 20), 1);
  assert.equal(productQuantity("1", 0), 0);
});
