import Link from "next/link";
import { getNavigation } from "@/lib/catalog";
import { getStore } from "@/config/store";
import { t } from "@/i18n";

export async function Header() {
  const store = getStore();
  const nav = await getNavigation();
  return (
    <header className="border-b border-line bg-surface">
      {store.showReview && (
        <div className="bg-warn-soft px-4 py-1.5 text-center text-xs text-warn">{t("review.banner")}</div>
      )}
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-xl font-bold tracking-tight">{store.name}</span>
          <span className="hidden text-xs text-ink-2 sm:inline">{t("site.tagline")}</span>
        </Link>
        <form action="/search" method="get" className="order-3 flex w-full sm:order-none sm:ml-auto sm:w-96">
          <input name="q" type="search" placeholder={t("search.placeholder")} aria-label={t("nav.search")}
                 className="w-full rounded-l-card border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
          <button className="rounded-r-card bg-accent px-4 text-sm text-accent-ink">{t("search.button")}</button>
        </form>
      </div>
      <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-2 pb-2 text-sm">
        {nav.map((c) => (
          <Link key={c.id} href={`/catalog/${c.slug}`}
                className="whitespace-nowrap rounded px-2.5 py-1.5 text-ink-2 hover:bg-bg hover:text-ink">
            {c.name}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-6 text-xs text-ink-2">{t("footer.note")}</div>
    </footer>
  );
}

export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="breadcrumbs" className="mb-4 flex flex-wrap gap-1 text-xs text-ink-2">
      {items.map((it, i) => (
        <span key={i} className="flex gap-1">
          {i > 0 && <span>/</span>}
          {it.href ? <Link href={it.href} className="hover:text-ink">{it.label}</Link> : <span className="text-ink">{it.label}</span>}
        </span>
      ))}
    </nav>
  );
}
