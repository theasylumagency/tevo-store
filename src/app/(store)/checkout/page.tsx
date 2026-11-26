import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { GEORGIA_REGIONS, getStore } from "@/config/store";
import { availablePaymentMethods, paymentsMode } from "@/lib/payments/providers";
import { CheckoutForm } from "@/components/cart/CheckoutForm";
import { t } from "@/i18n";

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
      <h1 className="mb-6 text-2xl font-bold">{t("checkout.title")}</h1>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-line/40" />}><Form /></Suspense>
    </>
  );
}
