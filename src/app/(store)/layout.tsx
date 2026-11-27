import { Footer, Header } from "@/components/Header";
import { getStore } from "@/config/store";
import { CartProvider } from "@/components/cart/CartProvider";
import { ChoiceProvider } from "@/components/choices/ChoiceProvider";
import { getIndex } from "@/lib/catalog";
import { t } from "@/i18n";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const store = getStore();
  const { visible } = await getIndex();
  return <>
    <a href="#main-content" className="skip-link">{t("nav.skip")}</a>
    <CartProvider storeId={store.id}>
      <ChoiceProvider storeId={store.id} products={visible.map((p) => ({ id: p.id, productType: p.product_type }))}>
      <Header />
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 outline-none">{children}</main>
      <Footer />
      </ChoiceProvider>
    </CartProvider>
  </>;
}
