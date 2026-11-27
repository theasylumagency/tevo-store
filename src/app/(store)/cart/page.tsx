import type { Metadata } from "next";
import { CartView } from "@/components/cart/CartView";
import { getStore } from "@/config/store";
import { t } from "@/i18n";
import ui from "@/components/storefront/foundation.module.css";
import styles from "@/components/cart/purchase.module.css";

export const metadata: Metadata = { title: t("cart.title"), robots: { index: false } };

export default function CartPage() {
  return (
    <>
      <header className={styles.pageHead}>
        <h1 className={ui.pageTitle}>{t("cart.title")}</h1>
        <p className={ui.lead}>გადაამოწმეთ პროდუქტები და რაოდენობა, შემდეგ გააფორმეთ შეკვეთა.</p>
      </header>
      <CartView maxQuantity={getStore().maxQuantityPerLine} />
    </>
  );
}
