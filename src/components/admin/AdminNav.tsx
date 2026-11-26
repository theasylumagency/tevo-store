import Link from "next/link";
import { logoutAction } from "@/app/actions/admin";
import { t } from "@/i18n";

export function AdminNav({ current, editor = false }: { current: "orders" | "settings" | "catalog"; editor?: boolean }) {
  const tab = (key: "orders" | "settings" | "catalog", href: string) => (
    <Link href={href} className={`rounded-full px-3 py-1 text-sm ${current === key ? "bg-accent-soft text-accent" : "text-ink-2 hover:text-ink"}`}>
      {key === "catalog" ? "კატალოგი" : t(`admin.nav.${key}`)}
    </Link>
  );
  return (
    <nav className="mb-4 flex items-center gap-2 border-b border-line pb-3">
      {!editor && tab("orders", "/admin")}
      {tab("catalog", "/admin/catalog")}
      {!editor && tab("settings", "/admin/settings")}
      <form action={logoutAction} className="ml-auto"><button className="text-sm text-ink-2 underline">{t("admin.logout")}</button></form>
    </nav>
  );
}
