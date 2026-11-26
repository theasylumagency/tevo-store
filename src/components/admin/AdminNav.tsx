import Link from "next/link";
import { logoutAction } from "@/app/actions/admin";
import { t } from "@/i18n";

export function AdminNav({ current }: { current: "orders" | "settings" }) {
  const tab = (key: "orders" | "settings", href: string) => (
    <Link href={href} className={`rounded-full px-3 py-1 text-sm ${current === key ? "bg-accent-soft text-accent" : "text-ink-2 hover:text-ink"}`}>
      {t(`admin.nav.${key}`)}
    </Link>
  );
  return (
    <nav className="mb-4 flex items-center gap-2 border-b border-line pb-3">
      {tab("orders", "/admin")}
      {tab("settings", "/admin/settings")}
      <form action={logoutAction} className="ml-auto"><button className="text-sm text-ink-2 underline">{t("admin.logout")}</button></form>
    </nav>
  );
}
