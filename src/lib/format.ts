import { formatNumber } from "./money";

export function formatPrice(v: number | null | undefined) {
  if (v === null || v === undefined) return null;
  return `${formatNumber(v)} ₾`;
}
