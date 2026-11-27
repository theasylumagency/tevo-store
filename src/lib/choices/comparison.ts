import { formatSpec } from "../catalog/product-presentation";
import { formatPrice } from "../format";
import { t } from "../../i18n";
import { cleanChoiceIds, MAX_COMPARE, type ChoiceProduct } from "./types";

export interface ComparisonRow {
  key: string;
  label: string;
  values: (string | null)[];
  different: boolean;
  kind: "identity" | "price" | "availability" | "attribute" | "spec";
}

/** Formatting differences do not imply a different specification; units and case retain their meaning. */
export function comparisonValue(value: string | null | undefined) {
  return value?.normalize("NFC").trim().replace(/\s+/gu, " ") || null;
}

export function sameComparisonType(products: readonly ChoiceProduct[]) {
  return products.length > 0 && products.every((product) => product.productType === products[0].productType);
}

/** Missing facts stay null, and source keys/units are never merged or converted. */
export function buildComparisonRows(products: readonly ChoiceProduct[]): ComparisonRow[] {
  if (!sameComparisonType(products)) return [];
  const rows: ComparisonRow[] = [];
  const add = (key: string, label: string, values: (string | null | undefined)[], kind: ComparisonRow["kind"]) => {
    const normalized = values.map(comparisonValue);
    rows.push({ key, label, values: normalized, different: new Set(normalized).size > 1, kind });
  };
  add("brand", "ბრენდი", products.map((p) => p.brand), "identity");
  add("model", "მოდელი", products.map((p) => p.model), "identity");
  add("price", "ფასი", products.map((p) => p.price.base === null ? null : formatPrice(p.price.promo ?? p.price.base)), "price");
  add("availability", "ხელმისაწვდომობა", products.map((p) => t(`product.availability.${p.availability}`)), "availability");

  const attributes = new Map(products.flatMap((p) => p.attributes.map((a) => [a.key, a.label] as const)));
  for (const [key, label] of attributes) {
    add(`attribute:${key}`, label || key, products.map((p) => {
      const value = p.attributes.find((a) => a.key === key)?.value;
      return typeof value === "boolean" ? value ? "კი" : "არა" : value;
    }), "attribute");
  }

  const specs = new Map<string, { label: string; units: Set<string> }>();
  for (const product of products) {
    for (const spec of product.specs) {
      if (spec.key === "model" || !spec.value.trim()) continue;
      const entry = specs.get(spec.key) ?? { label: "", units: new Set<string>() };
      entry.label = comparisonValue(spec.label) ?? spec.key;
      const unit = comparisonValue(spec.unit);
      if (unit) entry.units.add(unit);
      specs.set(spec.key, entry);
    }
  }
  const labelCounts = new Map<string, number>();
  for (const { label } of specs.values()) labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  for (const [key, { label, units }] of specs) {
    // Distinct measurements may share a human label (e.g. power in kW and hp).
    // Clarify only with units actually present in the source; never infer or convert them.
    const rowLabel = (labelCounts.get(label) ?? 0) > 1 && units.size > 0
      ? `${label} (${[...units].join(" / ")})` : label;
    add(`spec:${key}`, rowLabel, products.map((p) => {
      const spec = p.specs.find((s) => s.key === key && s.value.trim());
      return spec ? formatSpec(spec) : null;
    }), "spec");
  }
  return rows;
}

/** Query links are bounded independently of local storage; invalid input is disclosed by the view. */
export function parseComparisonQuery(input: string | string[] | undefined) {
  const shared = input !== undefined;
  const raw = (Array.isArray(input) ? input : [input ?? ""]).flatMap((value) => value.split(",")).filter(Boolean);
  const valid = cleanChoiceIds(raw, MAX_COMPARE + 1);
  const ids = valid.slice(0, MAX_COMPARE);
  return { shared, ids, trimmed: valid.length > MAX_COMPARE || raw.some((id) => !cleanChoiceIds([id]).length) };
}
