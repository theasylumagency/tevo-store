import { Footer, Header } from "@/components/Header";
import { getStore } from "@/config/store";
import { CartProvider } from "@/components/cart/CartProvider";
import { t } from "@/i18n";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  const store = getStore();
  return <>
    <a href="#main-content" className="skip-link">{t("nav.skip")}</a>
    <CartProvider storeId={store.id}>
      <Header />
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 outline-none">{children}</main>
      <Footer />
    </CartProvider>
  </>;
}
