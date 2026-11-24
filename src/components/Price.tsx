import type { Product } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { t } from "@/i18n";

export function Price({ price, size = "md" }: { price: Product["price"]; size?: "md" | "lg" }) {
  const big = size === "lg";
  if (price.base === null) return <span className="text-sm text-ink-2">{t("price.on_request")}</span>;
  const current = price.promo ?? price.base;
  return (
    <span className="flex items-baseline gap-2">
      <span className={`font-semibold text-accent ${big ? "text-3xl" : "text-lg"}`}>{formatPrice(current)}</span>
      {price.promo !== null && (
        <span className={`text-ink-2 line-through ${big ? "text-lg" : "text-sm"}`}>{formatPrice(price.base)}</span>
      )}
    </span>
  );
}
