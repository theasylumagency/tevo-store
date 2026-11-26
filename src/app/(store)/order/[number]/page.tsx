import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getOrderForCustomer } from "@/lib/orders/service";
import { retryPaymentAction } from "@/app/actions/checkout";
import { OrderSummary, StatusBadge } from "@/components/OrderSummary";
import { formatPhone } from "@/lib/phone";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("checkout.summary"), robots: { index: false, follow: false } };

async function OrderView({ params, searchParams }: PageProps<"/order/[number]">) {
  await connection();   // embedded DB answers synchronously: keep order data out of prerendering
  const [{ number }, sp] = await Promise.all([params, searchParams]);
  const token = Array.isArray(sp.t) ? sp.t[0] : sp.t;
  const data = await getOrderForCustomer(number, token);
  if (!data) return <p className="py-16 text-center text-ink-2">{t("order.not_found")}</p>;
  const { order, items } = data;
  const failed = order.status === "pending_payment" && order.paymentStatus === "failed";
  const waiting = order.status === "pending_payment" && order.paymentStatus !== "failed";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold" data-testid="order-number">{t("order.title", { n: order.number! })}</h1>
        <span data-testid="order-status"><StatusBadge status={order.status} /></span>
      </div>
      {failed ? (
        <div className="rounded-card border border-warn/40 bg-warn-soft p-4" role="alert">
          <p className="text-warn">{t("order.payment_failed")}</p>
          <form action={retryPaymentAction} className="mt-3">
            <input type="hidden" name="number" value={order.number!} /><input type="hidden" name="t" value={token} />
            <button className="rounded-card bg-accent px-4 py-2 text-accent-ink" data-testid="retry-payment">{t("order.pay_again")}</button>
          </form>
        </div>
      ) : waiting ? (
        <p className="rounded-card bg-warn-soft p-4 text-warn">{t("order.awaiting_payment")}</p>
      ) : (
        <div className="rounded-card border border-accent/30 bg-accent-soft p-4" data-testid="order-thanks">
          <p className="font-medium">{t("order.thanks")}</p>
          <p className="text-sm">{order.paymentStatus === "paid" ? t("order.thanks.paid")
                                  : t("order.thanks.cash", { phone: formatPhone(order.customerPhone) })}</p>
        </div>
      )}
      <OrderSummary order={order} items={items} />
      <p className="text-xs text-ink-2">{t("order.keep_link")}</p>
    </div>
  );
}

export default function OrderPage(props: PageProps<"/order/[number]">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-card bg-line/40" />}>
      <OrderView {...props} />
    </Suspense>
  );
}
