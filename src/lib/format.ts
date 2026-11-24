const fmt = new Intl.NumberFormat("ka-GE", { maximumFractionDigits: 2 });

export function formatPrice(v: number | null | undefined) {
  if (v === null || v === undefined) return null;
  return `${fmt.format(v)} ₾`;
}
