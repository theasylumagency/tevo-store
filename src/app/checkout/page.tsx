import type { Metadata } from "next";
import { GEORGIA_REGIONS, getStore } from "@/config/store";
import { paymentsMode } from "@/lib/payments/providers";
import { CheckoutForm } from "@/components/cart/CheckoutForm";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("checkout.title"), robots: { index: false } };

export default function CheckoutPage() {
  const store = getStore();
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">{t("checkout.title")}</h1>
      <CheckoutForm paymentMethods={store.paymentMethods} deliveryMethods={store.deliveryMethods}
                    regions={GEORGIA_REGIONS} testMode={paymentsMode() === "test"} />
    </>
  );
}
