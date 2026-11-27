import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { GEORGIA_REGIONS, getStore } from "@/config/store";
import { availablePaymentMethods, paymentsMode } from "@/lib/payments/providers";
import { CheckoutForm } from "@/components/cart/CheckoutForm";
import { PurchaseLoading } from "@/components/cart/PurchaseStates";
import { t } from "@/i18n";
import ui from "@/components/storefront/foundation.module.css";
import styles from "@/components/cart/purchase.module.css";

export const metadata: Metadata = { title: t("checkout.title"), robots: { index: false } };

/** Payment options depend on runtime configuration (bank credentials), so they are read per request. */
async function Form() {
  await connection();
  const store = getStore();
  return (
    <CheckoutForm paymentMethods={availablePaymentMethods(store.id, store.paymentMethods)}
                  deliveryMethods={store.deliveryMethods} regions={GEORGIA_REGIONS}
                  testMode={paymentsMode() === "test"} />
  );
}

export default function CheckoutPage() {
  return (
    <>
      <header className={styles.pageHead}>
        <Link href="/cart" className={`${ui.quietAction} ${styles.continueLink}`}>კალათაში დაბრუნება</Link>
        <h1 className={ui.pageTitle}>{t("checkout.title")}</h1>
        <p className={ui.lead}>შეავსეთ საკონტაქტო ინფორმაცია და აირჩიეთ მიღებისა და გადახდის წესი. რეგისტრაცია საჭირო არ არის.</p>
      </header>
      <Suspense fallback={<PurchaseLoading checkout />}><Form /></Suspense>
    </>
  );
}
