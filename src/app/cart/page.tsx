import type { Metadata } from "next";
import { CartView } from "@/components/cart/CartView";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("cart.title"), robots: { index: false } };

export default function CartPage() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">{t("cart.title")}</h1>
      <CartView />
    </>
  );
}
