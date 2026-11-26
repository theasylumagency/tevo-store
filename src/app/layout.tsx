import type { Metadata } from "next";
import "@fontsource-variable/noto-sans-georgian";
import "./globals.css";
import { getStore } from "@/config/store";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={store.locale} data-store={store.id} className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {children}
      </body>
    </html>
  );
}
