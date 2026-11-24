import type { Metadata } from "next";
import "@fontsource-variable/noto-sans-georgian";
import "./globals.css";
import { Footer, Header } from "@/components/Header";
import { getStore } from "@/config/store";
import { t } from "@/i18n";

const store = getStore();

export const metadata: Metadata = {
  title: { default: store.name, template: `%s — ${store.name}` },
  description: t("home.lead"),
  robots: store.showReview ? { index: false, follow: false } : undefined,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang={store.locale} data-store={store.id} className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <Header />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
