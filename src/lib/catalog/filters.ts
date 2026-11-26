import type { Catalog, Product, ProductType } from "./types";
import { translit } from "../translit";
import { t } from "@/i18n";
import { createSearchIndex, searchCatalog, type CatalogSearchIndex, type CatalogSearchResult } from "./search";
import { queryForFacetCounts } from "./filter-state";

export type SearchParams = Record<string, string | string[] | undefined>;

export type FacetKind = "brand" | "type" | "price" | "bool" | "enum" | "spec";

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
  exact?: boolean;
}

const RESERVED = new Set(["sort", "q", "exact", "price_from", "price_to", "page"]);

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export function parseQuery(sp: SearchParams, catalog?: Pick<Catalog, "attribute_vocabulary" | "spec_vocabulary">): ListingQuery {
  const filters: Record<string, string[]> = {};
  const allowed = new Set(["brand", "type", ...Object.keys(catalog?.attribute_vocabulary ?? {}),
    ...(catalog?.spec_vocabulary.map((spec) => spec.key) ?? [])]);
  for (const [k, v] of Object.entries(sp)) {
    // Marketing/click identifiers are URL context, never product constraints.
    if (RESERVED.has(k) || !allowed.has(k) || v === undefined) continue;
    const vals = (Array.isArray(v) ? v : [v]).flatMap((x) => x.split(",")).filter(Boolean);
    if (vals.length) filters[k] = vals;
  }
  const num = (s?: string) => (s && Number.isFinite(Number(s)) && Number(s) >= 0 ? Number(s) : undefined);
  const sort = first(sp.sort) as SortKey;
  return {
    filters,
    priceFrom: num(first(sp.price_from)),
    priceTo: num(first(sp.price_to)),
    sort: SORTS.includes(sort) ? sort : "default",
    q: first(sp.q)?.trim() || undefined,
    exact: first(sp.exact) === "1" || undefined,
  };
}

/** Value of a product for a facet key, as strings (attributes, brand or spec). */
export function facetValues(p: Product, key: string): string[] {
  if (key === "brand") return p.brand ? [p.brand] : [];
  if (key === "type") return [p.product_type];
  const a = p.attributes[key];
  if (typeof a === "boolean") return a ? ["1"] : [];
  if (typeof a === "string") return [a];
  const s = p.specs.find((x) => x.key === key);
  if (s) return [s.num !== undefined ? String(s.num) : s.value];
  return [];
}

export function priceOf(p: Product) {
  return p.price.promo ?? p.price.base;
}

function matchesFilters(p: Product, q: ListingQuery, skip?: string) {
  for (const [key, wanted] of Object.entries(q.filters)) {
    if (key === skip) continue;
    if (!wanted.length) continue;
    const have = facetValues(p, key);
    if (!wanted.some((w) => have.includes(w))) return false;
  }
  if (skip !== "price") {
    const price = priceOf(p);
    if ((q.priceFrom !== undefined || q.priceTo !== undefined) && price === null) return false;
    if (q.priceFrom !== undefined && price! < q.priceFrom) return false;
    if (q.priceTo !== undefined && price! > q.priceTo) return false;
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
  return searchCatalog(createSearchIndex(catalog, [p]), q, { exact: true }).total > 0;
}

const searchIndexes = new WeakMap<Catalog, WeakMap<Product[], CatalogSearchIndex>>();

/** Search before applying facets, so a filter never silently changes a correction. */
export function getSearchResult(products: Product[], q: ListingQuery, catalog: Catalog): CatalogSearchResult {
  let indexes = searchIndexes.get(catalog);
  if (!indexes) { indexes = new WeakMap(); searchIndexes.set(catalog, indexes); }
  let index = indexes.get(products);
  if (!index) { index = createSearchIndex(catalog, products); indexes.set(products, index); }
  if (!q.q) return { query: "", products: index.products.map((item) => ({ item, score: 0, match: "exact" })),
    total: index.products.length, correction: null, types: index.types, categories: index.categories };
  return searchCatalog(index, q.q, { exact: q.exact });
}

export function applyQuery(products: Product[], q: ListingQuery, catalog: Catalog) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const out = getSearchResult(products, q, catalog).products.map(({ item }) => byId.get(item.id)!)
    .filter((p) => matchesFilters(p, q));
  const byName = (a: Product, b: Product) => a.name.localeCompare(b.name, "ka");
  const byPrice = (a: Product, b: Product, direction: number) => {
    const ap = priceOf(a), bp = priceOf(b);
    if (ap === null) return bp === null ? byName(a, b) : 1;
    if (bp === null) return -1;
    return (ap - bp) * direction || byName(a, b);
  };
  if (q.sort === "price_asc") out.sort((a, b) => byPrice(a, b, 1));
  if (q.sort === "price_desc") out.sort((a, b) => byPrice(a, b, -1));
  if (q.sort === "name") out.sort(byName);
  return out;
}

function facetKeysFor(types: ProductType[], q: ListingQuery, catalog: Catalog, searched: Product[]): string[] {
  if (types.length === 1) return types[0].facets;
  const selected = q.filters.type ?? [];
  const foundTypes = new Set(searched.map((product) => product.product_type));
  const typeId = selected.length === 1 ? selected[0]
    : selected.length === 0 && foundTypes.size === 1 ? [...foundTypes][0] : undefined;
  const type = typeId ? catalog.product_types.find((candidate) => candidate.id === typeId) : undefined;
  return type ? ["type", ...type.facets] : ["type", "brand", "price"];
}

export function buildFacets(products: Product[], types: ProductType[], q: ListingQuery, catalog: Catalog,
                            brandNames: Map<string, string>): Facet[] {
  const facets: Facet[] = [];
  const specDefs = new Map(catalog.spec_vocabulary.map((s) => [s.key, s]));
  const searchIds = new Set(getSearchResult(products, q, catalog).products.map(({ item }) => item.id));
  const searched = products.filter((product) => searchIds.has(product.id));
  const typeNames = new Map(catalog.product_types.map((type) => [type.id, type.name_plural]));
  for (const key of facetKeysFor(types, q, catalog, searched)) {
    const countQuery = queryForFacetCounts(q, key);
    const pool = searched.filter((p) => matchesFilters(p, countQuery, key));
    if (key === "price") {
      const prices = (searched.length ? searched : products).map(priceOf).filter((x): x is number => x !== null && x >= 0);
      if (!prices.length || (prices.length < 2 && q.priceFrom === undefined && q.priceTo === undefined)) continue;
      facets.push({ key, label: t("filters.price"), kind: "price", options: [], selected: [],
        range: { min: Math.min(...prices), max: Math.max(...prices), from: q.priceFrom, to: q.priceTo } });
      continue;
    }
    const attr = catalog.attribute_vocabulary[key];
    const sdef = specDefs.get(key);
    const counts = new Map<string, number>();
    for (const p of pool) for (const v of facetValues(p, key)) counts.set(v, (counts.get(v) ?? 0) + 1);
    // offer values that exist in the whole listing, so a 0-count option stays visible
    for (const p of searched) for (const v of facetValues(p, key)) if (!counts.has(v)) counts.set(v, 0);
    for (const value of q.filters[key] ?? []) if (!counts.has(value)) counts.set(value, 0);
    if (counts.size === 0 || (attr?.type !== "bool" && counts.size < 2 && !q.filters[key]?.length)) continue;
    const kind: FacetKind = key === "brand" ? "brand" : key === "type" ? "type" : attr?.type === "bool" ? "bool" : sdef ? "spec" : "enum";
    let options: FacetOption[] = [...counts.entries()].map(([value, count]) => ({
      value, count,
      label: key === "brand" ? brandNames.get(value) ?? value
        : key === "type" ? typeNames.get(value) ?? value
        : kind === "bool" ? attr!.label
        : sdef?.unit ? `${value} ${sdef.unit}` : value,
    }));
    if (kind === "spec") options.sort((a, b) => Number(a.value) - Number(b.value) || a.value.localeCompare(b.value));
    else if (attr?.values) options.sort((a, b) => attr.values!.indexOf(a.value) - attr.values!.indexOf(b.value));
    else options.sort((a, b) => a.label.localeCompare(b.label, "ka"));
    if (kind === "bool") options = options.filter((o) => o.value === "1");
    const label = key === "brand" ? t("filters.brand") : key === "type" ? t("filters.type") : attr?.label ?? sdef?.label ?? key;
    facets.push({ key, label, kind, options, selected: q.filters[key] ?? [] });
  }
  return facets;
}
