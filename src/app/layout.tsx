import type { Metadata } from "next";
import "@fontsource-variable/noto-sans-georgian";
import "./globals.css";
import { Footer, Header } from "@/components/Header";
import { getStore } from "@/config/store";
import { CartProvider } from "@/components/cart/CartProvider";
import { t } from "@/i18n";
import { siteUrl } from "@/lib/site";

const store = getStore();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  openGraph: { siteName: store.name, locale: "ka_GE", type: "website" },
  title: { default: store.name, template: `%s — ${store.name}` },
  description: t("home.lead"),
  robots: store.showReview ? { index: false, follow: false } : undefined,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang={store.locale} data-store={store.id} className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <a href="#main-content" className="skip-link">{t("nav.skip")}</a>
        <CartProvider storeId={store.id}>
          <Header />
          <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 outline-none">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
