import type { Product } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { t } from "@/i18n";
import css from "./storefront/media.module.css";

export function Price({ price, size = "md" }: { price: Product["price"]; size?: "md" | "lg" }) {
  const big = size === "lg";
  if (price.base === null) return <span className={css.request}>{t("price.on_request")}</span>;
  const current = price.promo ?? price.base;
  return (
    <span className={`${css.price} ${big ? css.large : ""}`}>
      <span className={css.current}><span className="sr-only">ფასი: </span>{formatPrice(current)}</span>
      {price.promo !== null && (
        <span className={css.previous}><span className="sr-only">ძველი ფასი: </span><del>{formatPrice(price.base)}</del></span>
      )}
    </span>
  );
}
