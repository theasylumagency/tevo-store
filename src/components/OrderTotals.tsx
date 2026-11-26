import type { DeliveryMethod } from "@/config/store";
import { t } from "@/i18n";
import { formatTetri } from "@/lib/money";
import { cartCopy } from "./cart/cartCopy";

interface Props {
  subtotal: number;
  deliveryFee: number | null;
  deliveryMethod?: DeliveryMethod;
  /** Recorded total for an existing order. Never presented as final while delivery is unknown. */
  total?: number;
  testId?: string;
}

/** A missing delivery price is an unresolved charge, not free delivery. */
export function OrderTotals({ subtotal, deliveryFee, deliveryMethod, total, testId = "cart-total" }: Props) {
  const fee = deliveryMethod === "pickup" ? 0 : deliveryFee;
  const deliveryPending = fee === null;

  return (
    <div className="space-y-3">
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-2">{cartCopy.products}</dt>
          <dd className="shrink-0 tabular-nums">{formatTetri(subtotal)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-2">{deliveryMethod === "pickup" ? cartCopy.pickup : t("cart.delivery")}</dt>
          <dd className="text-right">{deliveryPending ? t("cart.delivery.by_phone") : fee === 0 ? t("cart.delivery.free") : formatTetri(fee)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-line pt-3 text-base font-semibold">
          <dt>{deliveryPending ? cartCopy.withoutDelivery : cartCopy.finalTotal}</dt>
          <dd className="shrink-0 text-accent tabular-nums" data-testid={testId}>
            {formatTetri(deliveryPending ? subtotal : (total ?? subtotal + fee))}
          </dd>
        </div>
      </dl>
      {deliveryPending && <p className="rounded-card bg-warn-soft px-3 py-2 text-sm leading-relaxed text-warn" data-testid="delivery-pending">{cartCopy.deliveryPending}</p>}
    </div>
  );
}
