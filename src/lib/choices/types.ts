import type { Product, Spec } from "../catalog/types";

/** Only public, current presentation data crosses the saved/comparison boundary. */
export interface ChoiceProduct {
  id: string;
  slug: string;
  name: string;
  model: string | null;
  brand: string | null;
  productType: string;
  productTypeLabel: string;
  typeHref: string;
  price: Product["price"];
  availability: Product["availability"]["status"];
  image: string | null;
  specs: Spec[];
  attributes: { key: string; label: string; value: string | boolean }[];
}

export interface ChoiceResult {
  products: ChoiceProduct[];
  missingIds: string[];
}

export interface ChoiceIdentity {
  id: string;
  productType: string;
}

export const MAX_COMPARE = 4;
export const MAX_SAVED = 50;

/** IDs are opaque catalog identifiers, never paths or executable content. */
export function cleanChoiceIds(input: unknown, limit = MAX_SAVED): string[] {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.filter((id): id is string =>
    typeof id === "string" && id.length > 0 && id.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(id),
  ))].slice(0, limit);
}

export function comparisonHref(ids: readonly string[]) {
  const selected = cleanChoiceIds(ids, MAX_COMPARE);
  return selected.length ? `/compare?ids=${selected.map(encodeURIComponent).join(",")}` : "/compare";
}
