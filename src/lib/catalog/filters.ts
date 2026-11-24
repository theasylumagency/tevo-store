import type { Catalog, Product, ProductType } from "./types";
import { translit } from "../translit";
import { t } from "@/i18n";

export type SearchParams = Record<string, string | string[] | undefined>;

export type FacetKind = "brand" | "price" | "bool" | "enum" | "spec";

export interface FacetOption {
  value: string;
  label: string;
  count: number;
}

export interface Facet {
  key: string;
  label: string;
  kind: FacetKind;
  options: FacetOption[];
  selected: string[];
  range?: { min: number; max: number; from?: number; to?: number };
}

export type SortKey = "default" | "price_asc" | "price_desc" | "name";
export const SORTS: SortKey[] = ["default", "price_asc", "price_desc", "name"];

export interface ListingQuery {
  filters: Record<string, string[]>;
  priceFrom?: number;
  priceTo?: number;
  sort: SortKey;
  q?: string;
}

const RESERVED = new Set(["sort", "q", "price_from", "price_to", "page"]);

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export function parseQuery(sp: SearchParams): ListingQuery {
  const filters: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (RESERVED.has(k) || v === undefined) continue;
    const vals = (Array.isArray(v) ? v : [v]).flatMap((x) => x.split(",")).filter(Boolean);
    if (vals.length) filters[k] = vals;
  }
  const num = (s?: string) => (s && !Number.isNaN(Number(s)) ? Number(s) : undefined);
  const sort = first(sp.sort) as SortKey;
  return {
    filters,
    priceFrom: num(first(sp.price_from)),
    priceTo: num(first(sp.price_to)),
    sort: SORTS.includes(sort) ? sort : "default",
    q: first(sp.q)?.trim() || undefined,
  };
}

/** Value of a product for a facet key, as strings (attributes, brand or spec). */
function valuesOf(p: Product, key: string): string[] {
  if (key === "brand") return p.brand ? [p.brand] : [];
  const a = p.attributes[key];
  if (typeof a === "boolean") return a ? ["1"] : [];
  if (typeof a === "string") return [a];
  const s = p.specs.find((x) => x.key === key);
  if (s) return [s.num !== undefined ? String(s.num) : s.value];
  return [];
}

export function priceOf(p: Product) {
  return p.price.promo ?? p.price.base ?? 0;
}

function matchesFilters(p: Product, q: ListingQuery, skip?: string) {
  for (const [key, wanted] of Object.entries(q.filters)) {
    if (key === skip) continue;
    const have = valuesOf(p, key);
    if (!wanted.some((w) => have.includes(w))) return false;
  }
  if (skip !== "price") {
    const price = priceOf(p);
    if (q.priceFrom !== undefined && price < q.priceFrom) return false;
    if (q.priceTo !== undefined && price > q.priceTo) return false;
  }
  return true;
}

export function searchText(p: Product, catalog: Catalog) {
  const brand = catalog.brands.find((b) => b.id === p.brand);
  const type = catalog.product_types.find((t) => t.id === p.product_type);
  const base = [p.name, p.name_legacy, p.subtitle, brand?.name, brand?.name_ka, p.model, type?.name, type?.name_plural,
    ...Object.values(p.codes)].filter(Boolean).join(" ").toLowerCase();
  return base + " " + translit(base);
}

export function matchesSearch(p: Product, catalog: Catalog, q?: string) {
  if (!q) return true;
  const hay = searchText(p, catalog);
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((tok) => hay.includes(tok) || hay.includes(translit(tok)));
}

export function applyQuery(products: Product[], q: ListingQuery, catalog: Catalog) {
  const out = products.filter((p) => matchesFilters(p, q) && matchesSearch(p, catalog, q.q));
  const byName = (a: Product, b: Product) => a.name.localeCompare(b.name, "ka");
  if (q.sort === "price_asc") out.sort((a, b) => priceOf(a) - priceOf(b));
  if (q.sort === "price_desc") out.sort((a, b) => priceOf(b) - priceOf(a));
  if (q.sort === "name") out.sort(byName);
  return out;
}

function facetKeysFor(types: ProductType[]): string[] {
  if (types.length === 1) return types[0].facets;
  return ["brand", "price"];
}

export function buildFacets(products: Product[], types: ProductType[], q: ListingQuery, catalog: Catalog,
                            brandNames: Map<string, string>): Facet[] {
  const facets: Facet[] = [];
  const specDefs = new Map(catalog.spec_vocabulary.map((s) => [s.key, s]));
  for (const key of facetKeysFor(types)) {
    const pool = products.filter((p) => matchesFilters(p, q, key) && matchesSearch(p, catalog, q.q));
    if (key === "price") {
      const prices = products.map(priceOf).filter((x) => x > 0);
      if (prices.length < 2) continue;
      facets.push({ key, label: t("filters.price"), kind: "price", options: [], selected: [],
        range: { min: Math.min(...prices), max: Math.max(...prices), from: q.priceFrom, to: q.priceTo } });
      continue;
    }
    const attr = catalog.attribute_vocabulary[key];
    const sdef = specDefs.get(key);
    const counts = new Map<string, number>();
    for (const p of pool) for (const v of valuesOf(p, key)) counts.set(v, (counts.get(v) ?? 0) + 1);
    // offer values that exist in the whole listing, so a 0-count option stays visible
    for (const p of products) for (const v of valuesOf(p, key)) if (!counts.has(v)) counts.set(v, 0);
    if (counts.size === 0 || (attr?.type !== "bool" && counts.size < 2)) continue;
    const kind: FacetKind = key === "brand" ? "brand" : attr?.type === "bool" ? "bool" : sdef ? "spec" : "enum";
    let options: FacetOption[] = [...counts.entries()].map(([value, count]) => ({
      value, count,
      label: key === "brand" ? brandNames.get(value) ?? value
        : kind === "bool" ? attr!.label
        : sdef?.unit ? `${value} ${sdef.unit}` : value,
    }));
    if (kind === "spec") options.sort((a, b) => Number(a.value) - Number(b.value) || a.value.localeCompare(b.value));
    else if (attr?.values) options.sort((a, b) => attr.values!.indexOf(a.value) - attr.values!.indexOf(b.value));
    else options.sort((a, b) => a.label.localeCompare(b.label, "ka"));
    if (kind === "bool") options = options.filter((o) => o.value === "1");
    const label = key === "brand" ? t("filters.brand") : attr?.label ?? sdef?.label ?? key;
    facets.push({ key, label, kind, options, selected: q.filters[key] ?? [] });
  }
  return facets;
}
