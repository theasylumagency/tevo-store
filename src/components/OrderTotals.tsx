import type { DeliveryMethod } from "@/config/store";
import { t } from "@/i18n";
import { formatTetri } from "@/lib/money";
import { cartCopy } from "./cart/cartCopy";
import styles from "./cart/purchase.module.css";

interface Props {
  subtotal: number;
  deliveryFee: number | null;
  deliveryMethod?: DeliveryMethod;
  /** Recorded total for an existing order. Never presented as final while delivery is unknown. */
  total?: number;
  testId?: string;
  presentation?: "storefront";
}

/** A missing delivery price is an unresolved charge, not free delivery. */
export function OrderTotals({ subtotal, deliveryFee, deliveryMethod, total, testId = "cart-total", presentation }: Props) {
  const fee = deliveryMethod === "pickup" ? 0 : deliveryFee;
  const deliveryPending = fee === null;
  const storefront = presentation === "storefront";

  return (
    <div className={storefront ? styles.totals : "space-y-3"}>
      <dl className={storefront ? styles.totalsList : "space-y-2 text-sm"}>
        <div className={storefront ? styles.totalRow : "flex justify-between gap-4"}>
          <dt className="text-ink-2">{cartCopy.products}</dt>
          <dd className="shrink-0 tabular-nums">{formatTetri(subtotal)}</dd>
        </div>
        <div className={storefront ? styles.totalRow : "flex justify-between gap-4"}>
          <dt className="text-ink-2">{deliveryMethod === "pickup" ? cartCopy.pickup : t("cart.delivery")}</dt>
          <dd className="text-right">{deliveryPending ? t("cart.delivery.by_phone") : fee === 0 ? t("cart.delivery.free") : formatTetri(fee)}</dd>
        </div>
        <div className={storefront ? `${styles.totalRow} ${styles.grandTotal}` : "flex justify-between gap-4 border-t border-line pt-3 text-base font-semibold"}>
          <dt>{deliveryPending ? cartCopy.withoutDelivery : cartCopy.finalTotal}</dt>
          <dd className={storefront ? undefined : "shrink-0 text-accent tabular-nums"} data-testid={testId}>
            {formatTetri(deliveryPending ? subtotal : (total ?? subtotal + fee))}
          </dd>
        </div>
      </dl>
      {deliveryPending && <p className={storefront ? styles.deliveryNote : "rounded-card bg-warn-soft px-3 py-2 text-sm leading-relaxed text-warn"} data-testid="delivery-pending">{cartCopy.deliveryPending}</p>}
    </div>
  );
}
