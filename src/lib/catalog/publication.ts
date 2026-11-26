import { z } from "zod";
import type { Catalog, Product } from "./types";
import { toTetri } from "../money";

export type PriceRule = { kind: "percent" | "fixed"; amount: number }; // basis points or tetri
export interface ProductEdits {
  name?: string;
  subtitle?: string | null;
  description?: string;
  features?: string[];
  rule?: PriceRule;
}
export type PriceOrigin = { origin: "product" | "store" | "source"; rule: PriceRule | null };

export class CatalogInputError extends Error {}

export function parseRule(kind: string, value: string): PriceRule | null {
  if (kind === "inherit") return null;
  const decimal = value.trim().replace(",", ".");
  if ((kind !== "percent" && kind !== "fixed") || !/^\d{1,7}(\.\d{1,2})?$/.test(decimal)) {
    throw new CatalogInputError("მიუთითე არაუარყოფითი დანამატი, მაქსიმუმ ორი ათწილადით.");
  }
  return { kind, amount: toTetri(Number(decimal)) };
}

export function effectivePrice(original: Product["price"], rule: PriceRule | null): Product["price"] {
  function markedUp(value: number | null) {
    if (value === null || !rule) return value;
    const base = toTetri(value);
    const extra = rule.kind === "fixed" ? rule.amount : Math.round(base * rule.amount / 10_000);
    if (!Number.isSafeInteger(base + extra) || base + extra > 2_147_483_647) {
      throw new CatalogInputError("გამოთვლილი ფასი დასაშვებ ზღვარს აჭარბებს.");
    }
    return (base + extra) / 100;
  }
  return { currency: "GEL", base: markedUp(original.base), promo: markedUp(original.promo) };
}

export function prepareProduct(source: Product, edits: ProductEdits, globalRule: PriceRule | null) {
  const { rule, ...text } = edits;
  const applied: PriceOrigin = { origin: rule ? "product" : globalRule ? "store" : "source", rule: rule ?? globalRule };
  return { product: { ...source, ...text, price: effectivePrice(source.price, applied.rule) }, applied };
}

export function prepareCatalog(source: Catalog, overrides: Map<string, ProductEdits>, rule: PriceRule | null, version: string) {
  const pricing: Record<string, PriceOrigin> = {};
  const products = source.products.map((sourceProduct) => {
    const { product, applied } = prepareProduct(sourceProduct, overrides.get(sourceProduct.id) ?? {}, rule);
    pricing[product.id] = applied;
    return product;
  });
  return { published: { ...source, generated_at: version, products }, pricing };
}

const text = z.string();
const strings = z.array(text);
const optionalText = text.nullable().default(null);
const positivePrice = z.number().positive().max(21_474_836.47).nullable();
const product = z.looseObject({
  id: text.regex(/^at-\d+$/), slug: text.regex(/^[a-z0-9-]+$/), name: text.min(1),
  subtitle: optionalText, name_legacy: optionalText, model: optionalText, brand: optionalText,
  legacy_wp_id: z.number().int().nullable().default(null), variant_group: optionalText,
  category: text, product_type: text, visible: z.boolean(), description: text, features: strings,
  price: z.object({ currency: z.literal("GEL"), base: positivePrice, promo: positivePrice.default(null) })
    .refine(p => p.promo === null || (p.base !== null && p.promo <= p.base)),
  availability: z.looseObject({ status: z.enum(["in_stock","low_stock","out_of_stock","confirm_with_store"]) }),
  codes: z.record(text, text), attributes: z.record(text, z.union([text, z.boolean()])),
  specs: z.array(z.looseObject({ key: text, label: text, value: text, unit: text.optional(), num: z.number().optional() })),
  media: z.array(z.looseObject({ file: text.min(1).refine(path => !path.startsWith("/") && !/[\\?#]/.test(path) && !path.split("/").includes("..")), role: z.enum(["main","gallery"]), position: z.number().int() })),
  relations: z.array(z.looseObject({ type: z.enum(["spare_part","accessory","consumable","fits","variant","same_size"]), product_id: text })),
  videos: z.array(z.httpUrl()).default([]), compatibility: z.looseObject({ note: text.optional() }).nullable().default(null),
  data_quality: z.looseObject({ score: z.number(), issues: strings }),
});
const catalog = z.looseObject({
  schema_version: text.regex(/^1\./), generated_at: text.refine(v => Number.isFinite(Date.parse(v))), source: z.looseObject({ kind: text }),
  brands: z.array(z.looseObject({ id: text, name: text, name_ka: text.optional() })),
  categories: z.array(z.looseObject({ id: text, name: text, position: z.number(), product_types: strings })),
  product_types: z.array(z.looseObject({ id: text, name: text, name_plural: text, category: text, facets: strings })),
  attribute_vocabulary: z.record(text, z.looseObject({ label: text, type: z.enum(["enum","bool","text"]) })),
  spec_vocabulary: z.array(z.looseObject({ key: text, label: text, group: text, unit: optionalText })),
  quality_issue_labels: z.record(text, text), products: z.array(product),
});

export function validateImport(input: Catalog): Catalog {
  const parsed = catalog.safeParse(input);
  if (!parsed.success) {
    throw new CatalogInputError("კატალოგის ველი არასწორია — " + parsed.error.issues[0].path.join("."));
  }
  const data = parsed.data;
  const ids = new Set(data.products.map(p => p.id));
  const slugs = new Set(data.products.map(p => p.slug));
  const categories = new Set(data.categories.map(c => c.id));
  const types = new Map(data.product_types.map(t => [t.id, t.category]));
  if (ids.size !== data.products.length || slugs.size !== data.products.length ||
      data.products.some(p => !categories.has(p.category) || types.get(p.product_type) !== p.category)) {
    throw new CatalogInputError("შეამოწმე პროდუქტის კოდი, მისამართი და კატეგორია.");
  }
  return data;
}
