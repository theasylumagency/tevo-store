import Link from "next/link";
import type { Order, OrderItem } from "@/db/schema";
import { formatTetri } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { t, type MessageKey } from "@/i18n";
import { OrderTotals } from "./OrderTotals";
import { cartCopy } from "./cart/cartCopy";
import styles from "./cart/purchase.module.css";

export function StatusBadge({ status, storefront = false }: { status: string; storefront?: boolean }) {
  const tone = status === "cancelled" ? "bg-line text-ink-2"
    : status === "pending_payment" ? "bg-warn-soft text-warn"
    : status === "completed" ? "bg-ink text-surface" : "bg-accent-soft text-accent";
  return <span className={`${storefront ? styles.storeBadge : "inline-block rounded px-2 py-0.5 text-xs font-medium"} ${tone}`}>{t(`status.${status}` as MessageKey)}</span>;
}

export function PayBadge({ status, storefront = false }: { status: string; storefront?: boolean }) {
  const tone = status === "paid" ? "bg-accent-soft text-accent" : status === "failed" ? "bg-warn-soft text-warn" : "bg-line/60 text-ink-2";
  return <span className={`${storefront ? styles.storeBadge : "inline-block rounded px-2 py-0.5 text-xs"} ${tone}`}>{t(`pay.${status}` as MessageKey)}</span>;
}

export function OrderSummary({ order, items, presentation }: { order: Order; items: OrderItem[]; presentation?: "storefront" }) {
  const storefront = presentation === "storefront";
  return (
    <div className={storefront ? styles.receiptGrid : "grid gap-6 lg:grid-cols-[1fr_320px]"}>
      <section className={storefront ? styles.receiptItems : "rounded-card border border-line bg-surface"}>
        <h2 className={storefront ? styles.receiptSectionTitle : "border-b border-line px-4 py-3 font-semibold"}>{t("order.items")}</h2>
        <ul className={storefront ? undefined : "divide-y divide-line"}>
          {items.map((i) => (
            <li key={i.id} className={storefront ? styles.receiptLine : "flex justify-between gap-4 px-4 py-3 text-sm"}>
              <span><Link href={`/p/${i.slug}`} className="font-medium hover:text-accent">{i.name}</Link>
                <span className="text-ink-2"> × {i.quantity}</span>
                <span className={storefront ? styles.receiptUnit : "block text-xs text-ink-2"}>{formatTetri(i.unitPrice)}{storefront && " / ერთეული"}</span></span>
              <span className={storefront ? styles.receiptLineTotal : "whitespace-nowrap"}>{formatTetri(i.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <div className={storefront ? styles.receiptTotals : "border-t border-line px-4 py-4"}>
          <OrderTotals subtotal={order.subtotal} deliveryFee={order.deliveryFee}
                       deliveryMethod={order.deliveryMethod === "pickup" ? "pickup" : "delivery"}
                       total={order.total} testId="order-total" presentation={presentation} />
        </div>
      </section>
      <aside className={storefront ? styles.receiptDetails : "space-y-4 text-sm"}>
        <div className={storefront ? styles.receiptDetail : "rounded-card border border-line bg-surface p-4"}>
          <h3 className="mb-1 font-semibold">{t("order.customer")}</h3>
          <p>{order.customerName}</p>
          <p className="text-ink-2">{formatPhone(order.customerPhone)}{order.customerEmail ? ` · ${order.customerEmail}` : ""}</p>
        </div>
        <div className={storefront ? styles.receiptDetail : "rounded-card border border-line bg-surface p-4"}>
          <h3 className="mb-1 font-semibold">{t("order.delivery")}</h3>
          <p>{t(`checkout.delivery.${order.deliveryMethod}` as MessageKey)}</p>
          {order.deliveryMethod === "delivery" && <p className="text-ink-2">{[order.region, order.city, order.address].filter(Boolean).join(", ")}</p>}
          {order.comment && <p className="mt-2 italic text-ink-2">„{order.comment}“</p>}
        </div>
        <div className={storefront ? styles.receiptDetail : "rounded-card border border-line bg-surface p-4"}>
          <h3 className="mb-1 font-semibold">{t("order.payment")}</h3>
          <p className={storefront ? styles.receiptPayment : "flex items-center gap-2"}>{t(`checkout.payment.${order.paymentMethod}` as MessageKey)} <PayBadge status={order.paymentStatus} storefront={storefront} /></p>
          {order.paymentStatus === "paid" && order.deliveryMethod === "delivery" && order.deliveryFee === null && <p className="mt-2 leading-relaxed text-ink-2">{cartCopy.paidProductsOnly}</p>}
        </div>
      </aside>
    </div>
  );
}
