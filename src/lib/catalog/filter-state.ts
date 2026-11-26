import type { ListingQuery } from "./filters";

/** Only the values needed for draft facet counts cross the server/client boundary. */
export interface FacetRecord {
  id: string;
  price: number | null;
  values: Record<string, string[]>;
}

export type PriceRangeResult =
  | { valid: true; from?: number; to?: number }
  | { valid: false; reason: "number" | "order" };

export function readPriceRange(from: string, to: string): PriceRangeResult {
  const read = (raw: string) => {
    const value = raw.trim().replace(/\s/g, "").replace(",", ".");
    if (!value) return undefined;
    if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return Number.NaN;
    const number = Number(value);
    return Number.isFinite(number) ? number : Number.NaN;
  };
  const low = read(from);
  const high = read(to);
  if (Number.isNaN(low) || Number.isNaN(high)) return { valid: false, reason: "number" };
  if (low !== undefined && high !== undefined && low > high) return { valid: false, reason: "order" };
  return { valid: true, from: low, to: high };
}

export function listingHref(pathname: string, query: ListingQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.exact) params.set("exact", "1");
  for (const key of Object.keys(query.filters).sort()) {
    const values = [...new Set(query.filters[key])].filter(Boolean).sort();
    if (values.length) params.set(key, values.join(","));
  }
  if (query.priceFrom !== undefined) params.set("price_from", String(query.priceFrom));
  if (query.priceTo !== undefined) params.set("price_to", String(query.priceTo));
  if (query.sort !== "default") params.set("sort", query.sort);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function withoutFilters(query: ListingQuery): ListingQuery {
  return { ...query, filters: {}, priceFrom: undefined, priceTo: undefined };
}

export function activeFilterCount(query: ListingQuery): number {
  return Object.values(query.filters).reduce((n, values) => n + values.length, 0)
    + Number(query.priceFrom !== undefined || query.priceTo !== undefined);
}

export function matchesFacetRecord(record: FacetRecord, query: ListingQuery, skip?: string): boolean {
  for (const [key, wanted] of Object.entries(query.filters)) {
    if (key === skip || !wanted.length) continue;
    if (!wanted.some((value) => record.values[key]?.includes(value))) return false;
  }
  if (skip !== "price") {
    if ((query.priceFrom !== undefined || query.priceTo !== undefined) && record.price === null) return false;
    if (query.priceFrom !== undefined && record.price! < query.priceFrom) return false;
    if (query.priceTo !== undefined && record.price! > query.priceTo) return false;
  }
  return true;
}

/** Changing product type discards technical facets; its counts must predict that same action. */
export function queryForFacetCounts(query: ListingQuery, key: string): ListingQuery {
  if (key !== "type") return query;
  return { ...query, filters: query.filters.brand?.length ? { brand: query.filters.brand } : {} };
}

export function countFacetOptions(records: FacetRecord[], query: ListingQuery, key: string): Map<string, number> {
  const counts = new Map<string, number>();
  const countQuery = queryForFacetCounts(query, key);
  for (const record of records) {
    if (!matchesFacetRecord(record, countQuery, key)) continue;
    for (const value of new Set(record.values[key] ?? [])) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}
