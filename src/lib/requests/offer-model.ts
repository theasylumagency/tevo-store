import type { Catalog, Product } from "../catalog/types";
import type { DeliveryMethod } from "../../config/store";
import type { RequestLine } from "./model";

export const OFFER_STATES = ["issued", "superseded", "withdrawn", "clarification", "rejected", "accepted"] as const;
export type OfferState = typeof OFFER_STATES[number];
export const OFFER_LABELS: Record<OfferState | "expired", string> = {
  issued: "მოქმედია", superseded: "ჩანაცვლებულია", withdrawn: "გაუქმებულია", clarification: "დაზუსტება მოთხოვნილია",
  rejected: "უარყოფილია", accepted: "მიღებულია", expired: "ვადა გასულია",
};
export interface OfferLine {
  productId: string; slug: string; name: string; model: string | null; brand: string | null;
  qty: number; unitPrice: number; lineTotal: number; availability: Product["availability"]["status"];
}
export interface OfferVersion {
  version: number;
  state: OfferState;
  lines: OfferLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  deliveryMethod: DeliveryMethod;
  region: string | null;
  city: string | null;
  address: string;
  fulfilment: string;
  paymentMethod: "cash";
  issuedAt: string;
  expiresAt: string;
  catalogVersion: string;
  termsVersion: string;
  stockEvidence: string;
  decidedAt?: string;
  clarification?: string;
}
export type PublicOffer = Omit<OfferVersion, "stockEvidence">;
export function publicOffer({ stockEvidence: _internal, ...offer }: OfferVersion): PublicOffer {
  void _internal;
  return offer;
}
export function offerState(offer: Pick<OfferVersion, "state" | "expiresAt">, now = Date.now()): OfferState | "expired" {
  return offer.state === "issued" && Date.parse(offer.expiresAt) <= now ? "expired" : offer.state;
}
export function activeOffer(offer: Pick<OfferVersion, "state" | "expiresAt"> | undefined, now = Date.now()) {
  return !!offer && offerState(offer, now) === "issued";
}
/** Strict decimal money input: blank is unknown, not zero; no rounding or implicit coercion. */
export function parseOfferMoney(input: string, allowZero = false): number | null {
  const value = input.trim().replace(",", ".");
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(value)) return null;
  const tetri = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(tetri) || tetri > 2_147_483_647 || tetri < (allowZero ? 0 : 1)) return null;
  return tetri;
}
/** Exact requested quantities; no silent substitution or partial order. Prices come from the authorized staff offer. */
export function offerLines(catalog: Catalog, requested: readonly RequestLine[], prices: Record<string, number>, maxQuantity: number): OfferLine[] | null {
  const products = new Map(catalog.products.filter(p => p.visible).map(p => [p.id, p]));
  const brands = new Map(catalog.brands.map(b => [b.id, b.name]));
  if (!requested.length || requested.length > 30 || Object.keys(prices).length !== requested.length) return null;
  const seen = new Set<string>();
  const lines: OfferLine[] = [];
  for (const item of requested) {
    const p = products.get(item.productId);
    const price = prices[item.productId];
    if (!p || p.availability.status === "out_of_stock" || seen.has(item.productId) ||
        !Number.isInteger(item.qty) || item.qty < 1 || item.qty > maxQuantity ||
        !Number.isSafeInteger(price) || price <= 0 || price * item.qty > 2_147_483_647) return null;
    seen.add(item.productId);
    lines.push({ productId: p.id, slug: p.slug, name: p.name, model: p.model, brand: p.brand ? brands.get(p.brand) ?? null : null,
      qty: item.qty, unitPrice: price, lineTotal: price * item.qty, availability: p.availability.status });
  }
  return lines;
}
export function offerStockStillValid(offer: OfferVersion, catalog: Catalog, maxQuantity: number) {
  const products = new Map(catalog.products.filter(p => p.visible).map(p => [p.id, p]));
  const brands = new Map(catalog.brands.map(b => [b.id, b.name]));
  return offer.lines.every(line => {
    const p = products.get(line.productId);
    if (!p || p.availability.status === "out_of_stock" || line.qty > maxQuantity ||
        p.model !== line.model || (p.brand ? brands.get(p.brand) ?? null : null) !== line.brand) return false;
    // An unknown canonical stock may be individually verified by staff. A new
    // publication with unknown stock invalidates that evidence conservatively.
    return p.availability.status !== "confirm_with_store" ||
      (line.availability === "confirm_with_store" && catalog.generated_at === offer.catalogVersion);
  });
}
