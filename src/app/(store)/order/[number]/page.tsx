import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getOrderForCustomer } from "@/lib/orders/service";
import { retryPaymentAction } from "@/app/actions/checkout";
import { OrderSummary, StatusBadge } from "@/components/OrderSummary";
import { RetryPaymentButton } from "@/components/cart/RetryPaymentButton";
import { customerOrderPresentation } from "@/lib/orders/presentation";
import { t } from "@/i18n";
import ui from "@/components/storefront/foundation.module.css";
import styles from "@/components/cart/purchase.module.css";

export const metadata: Metadata = { title: t("checkout.summary"), robots: { index: false, follow: false } };

async function OrderView({ params, searchParams }: PageProps<"/order/[number]">) {
  await connection();   // embedded DB answers synchronously: keep order data out of prerendering
  const [{ number }, sp] = await Promise.all([params, searchParams]);
  const token = Array.isArray(sp.t) ? sp.t[0] : sp.t;
  const data = await getOrderForCustomer(number, token);
  if (!data) return <section className={ui.state}>
    <h1 className={ui.stateTitle}>{t("order.not_found")}</h1>
    <p className={ui.stateCopy}>გახსენით შეკვეთის მიღებისას მოწოდებული სრული ბმული. დახმარებისთვის დაგვიკავშირდით.</p>
    <div className={ui.actions}><Link href="/info/contact" className={ui.primaryAction}>კონტაქტი</Link><Link href="/search" className={ui.secondaryAction}>{t("cart.continue")}</Link></div>
  </section>;
  const { order, items } = data;
  const presentation = customerOrderPresentation(order);

  return (
    <div className={styles.cartBody}>
      <header className={styles.pageHead}>
        <div className={styles.receiptMeta}>
          <h1 className={ui.pageTitle} data-testid="order-number">{t("order.title", { n: order.number! })}</h1>
          <span data-testid="order-status"><StatusBadge status={order.status} storefront /></span>
        </div>
        <p className={styles.summaryHint}>{t("order.keep_link")}</p>
      </header>
      <section className={styles.receiptFeedback} data-tone={presentation.tone} role={presentation.canRetryPayment ? "alert" : undefined}
        data-testid={presentation.received ? "order-thanks" : "order-feedback"} aria-labelledby="order-feedback-heading">
        <h2 id="order-feedback-heading">{presentation.title}</h2>
        <p>{presentation.detail}</p>
        {sp.payment_blocked === "stock" && <p role="alert">ხელმისაწვდომობა შეიცვალა ან დასაზუსტებელია. გადახდამდე დაუკავშირდით მაღაზიას და მიუთითეთ შეკვეთის ნომერი.</p>}
        {presentation.canRetryPayment && sp.payment_blocked !== "stock" && (
          <form action={retryPaymentAction}>
            <input type="hidden" name="number" value={order.number!} /><input type="hidden" name="t" value={token} />
            <RetryPaymentButton />
          </form>
        )}
      </section>
      <OrderSummary order={order} items={items} presentation="storefront" />
      <div className={styles.receiptFooter}>
        <p>კითხვებისთვის მოგვწერეთ ან დაგვირეკეთ და მიუთითეთ შეკვეთის ნომერი.</p>
        <div className={ui.actions}><Link href="/info/contact" className={ui.secondaryAction}>დაკავშირება</Link><Link href="/search" className={ui.quietAction}>{t("cart.continue")}</Link></div>
      </div>
    </div>
  );
}

export default function OrderPage(props: PageProps<"/order/[number]">) {
  return (
    <Suspense fallback={<div role="status" className={styles.cartBody}><p className={styles.loadingNote}>შეკვეთა იტვირთება…</p><div className={`${ui.skeleton} ${styles.loadingSummary}`} aria-hidden="true" /></div>}>
      <OrderView {...props} />
    </Suspense>
  );
}
