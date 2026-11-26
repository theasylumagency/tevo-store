import type { Product } from "@/lib/catalog/types";
import { toTetri, formatTetri } from "@/lib/money";
import { priceText } from "../catalog/format";

export function Price({ value }: { value: Product["price"] | null }) {
  if (!value) return <span aria-label="კატალოგში არ იყო">—</span>;
  return <span className="whitespace-nowrap">
    {value.promo !== null && <><span className="sr-only">ჩვეულებრივი ფასი </span><del className="block text-xs text-ink-2">{priceText(value.base)}</del>
      <span className="sr-only">აქციის ფასი </span></>}
    {priceText(value.promo ?? value.base)}
  </span>;
}

export function PriceDifference({ before, after }: { before: Product["price"]; after: Product["price"] }) {
  const from = before.promo ?? before.base;
  const to = after.promo ?? after.base;
  if (from === null || to === null || from === to) return null;
  const delta = toTetri(to) - toTetri(from);
  return <span className="block whitespace-nowrap text-xs font-normal text-ink-2">
    {delta > 0 ? "+" : ""}{formatTetri(delta)}
  </span>;
}
