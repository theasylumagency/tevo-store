import assert from "node:assert/strict";
import { test } from "node:test";
import { buildComparisonRows, comparisonValue, parseComparisonQuery, sameComparisonType } from "../src/lib/choices/comparison";
import { comparisonHref, type ChoiceProduct } from "../src/lib/choices/types";

const product = (id: string, patch: Partial<ChoiceProduct> = {}): ChoiceProduct => ({
  id, slug: id, name: `პროდუქტი ${id}`, model: null, brand: "AGRI", productType: "MOTOBLOCK", productTypeLabel: "მოტობლოკები", typeHref: "/catalog/agri/motoblock",
  price: { base: 100, promo: null, currency: "GEL" }, availability: "confirm_with_store", image: null, specs: [], attributes: [], ...patch,
});

test("comparison unions spec keys, keeps source units, and distinguishes missing values from zero", () => {
  const a = product("a", { specs: [{ key: "power_hp", label: "სიმძლავრე", value: "7", unit: "HP" }, { key: "weight", label: "წონა", value: "0", unit: "kg" }] });
  const b = product("b", { specs: [{ key: "power_kw", label: "სიმძლავრე", value: "5.2", unit: "kW" }, { key: "weight", label: "წონა", value: " " }] });
  const rows = buildComparisonRows([a, b]);
  assert.deepEqual(rows.find((row) => row.key === "spec:power_hp")?.values, ["7 HP", null]);
  assert.deepEqual(rows.find((row) => row.key === "spec:power_kw")?.values, [null, "5.2 kW"]);
  assert.deepEqual(rows.find((row) => row.key === "spec:weight")?.values, ["0 kg", null]);
  assert.equal(rows.find((row) => row.key === "spec:weight")?.different, true);
});

test("comparison treats explicit false as a fact and missing fields as unknown", () => {
  const rows = buildComparisonRows([
    product("a", { attributes: [{ key: "starter", label: "სტარტერი", value: false }] }),
    product("b", { attributes: [] }),
    product("c", { attributes: [{ key: "starter", label: "სტარტერი", value: true }] }),
  ]);
  assert.deepEqual(rows.find((row) => row.key === "attribute:starter")?.values, ["არა", null, "კი"]);
  assert.equal(rows.find((row) => row.key === "model")?.different, false);
});

test("duplicate specification labels are clarified by source units without merging keys or inventing units", () => {
  const rows = buildComparisonRows([
    product("a", { specs: [{ key: "power_kw", label: "სიმძლავრე", value: "3.2", unit: "კვტ" }] }),
    product("b", { specs: [{ key: "power_hp", label: "სიმძლავრე", value: "7", unit: "ცხ.ძ." }, { key: "power_unknown", label: "სიმძლავრე", value: "12" }] }),
  ]);
  const kw = rows.find((row) => row.key === "spec:power_kw");
  const hp = rows.find((row) => row.key === "spec:power_hp");
  assert.equal(kw?.label, "სიმძლავრე (კვტ)");
  assert.equal(hp?.label, "სიმძლავრე (ცხ.ძ.)");
  assert.deepEqual(kw?.values, ["3.2 კვტ", null]);
  assert.deepEqual(hp?.values, [null, "7 ცხ.ძ."]);
  assert.equal(rows.find((row) => row.key === "spec:power_unknown")?.label, "სიმძლავრე");
  assert.equal(buildComparisonRows([product("only", { specs: [{ key: "power_kw", label: "სიმძლავრე", value: "3.2", unit: "კვტ" }] })]).find((row) => row.key === "spec:power_kw")?.label, "სიმძლავრე");
});

test("differences ignore whitespace but never silently convert or lowercase measurement units", () => {
  assert.equal(comparisonValue("  7  HP  "), "7 HP");
  assert.equal(comparisonValue(" \n "), null);
  const make = (value: string) => product(value, { specs: [{ key: "power", label: "სიმძლავრე", value }] });
  assert.equal(buildComparisonRows([make("7 HP"), make(" 7  HP ")]).find((r) => r.key === "spec:power")?.different, false);
  assert.equal(buildComparisonRows([make("7 mW"), make("7 MW")]).find((r) => r.key === "spec:power")?.different, true);
});

test("comparison rejects mixed product types and formats current public price/availability", () => {
  assert.equal(sameComparisonType([]), false);
  assert.equal(sameComparisonType([product("a")]), true);
  assert.deepEqual(buildComparisonRows([product("a"), product("b", { productType: "TIRE" })]), []);
  const rows = buildComparisonRows([product("a", { price: { base: 100, promo: 80, currency: "GEL" }, availability: "out_of_stock" }), product("b", { price: { base: null, promo: null, currency: "GEL" } })]);
  assert.deepEqual(rows.find((r) => r.key === "price")?.values, ["80 ₾", null]);
  assert.deepEqual(rows.find((r) => r.key === "availability")?.values, ["არ არის მარაგში", "მარაგს გადაგიმოწმებთ შეკვეთისას"]);
});

test("shared links preserve explicit empty selection, bound IDs, and disclose invalid/extra input", () => {
  assert.deepEqual(parseComparisonQuery(undefined), { shared: false, ids: [], trimmed: false });
  assert.deepEqual(parseComparisonQuery(""), { shared: true, ids: [], trimmed: false });
  assert.deepEqual(parseComparisonQuery(["a,a,b", "c,d,e"]), { shared: true, ids: ["a", "b", "c", "d"], trimmed: true });
  assert.deepEqual(parseComparisonQuery("a,../bad,b"), { shared: true, ids: ["a", "b"], trimmed: true });
  assert.equal(comparisonHref(["a", "b", "b"]), "/compare?ids=a,b");
});
