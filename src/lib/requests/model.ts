import type { Product } from "../catalog/types";
import { toTetri } from "../money";

export const REQUEST_STATUSES = ["new", "in_review", "answered", "closed"] as const;
export type RequestStatus = typeof REQUEST_STATUSES[number];
export const REQUEST_LABELS: Record<RequestStatus, string> = {
  new: "მიღებულია", in_review: "განხილვაშია", answered: "პასუხი მზადაა", closed: "დახურულია",
};
export type RequestDelivery = "pickup" | "delivery" | "undecided";
export const DELIVERY_LABELS: Record<RequestDelivery, string> = {
  pickup: "თვითგატანა", delivery: "მიწოდება", undecided: "ჯერ არ გადამიწყვეტია",
};
export interface RequestLine {
  productId: string;
  slug: string;
  name: string;
  qty: number;
  unitPrice: number | null;
  availability: Product["availability"]["status"];
}
export interface RequestHistory {
  status: RequestStatus;
  response: string | null;
  at: string;
}
export function nextRequestStatuses(status: RequestStatus): RequestStatus[] {
  switch (status) {
    case "new": return ["in_review", "answered", "closed"];
    case "in_review": return ["answered", "closed"];
    case "answered": return ["in_review", "answered", "closed"];
    case "closed": return [];
  }
}
export function snapshotRequestLines(
  products: readonly Product[],
  items: readonly { productId: string; qty: number }[],
  maxQuantity: number,
): RequestLine[] | null {
  if (!items.length || items.length > 30) return null;
  const visible = new Map(products.filter(p => p.visible).map(p => [p.id, p]));
  const used = new Set<string>();
  const result: RequestLine[] = [];
  for (const item of items) {
    const p = visible.get(item.productId);
    if (!p || used.has(item.productId) || !Number.isInteger(item.qty) || item.qty < 1 || item.qty > maxQuantity) return null;
    used.add(item.productId);
    const price = p.price.promo ?? p.price.base;
    result.push({ productId: p.id, slug: p.slug, name: p.name, qty: item.qty,
      unitPrice: price !== null && Number.isFinite(price) && price > 0 ? toTetri(price) : null,
      availability: p.availability.status });
  }
  return result;
}
