import Link from "next/link";
import { getNavigation } from "@/lib/catalog";
import { getStore } from "@/config/store";
import { t } from "@/i18n";
import { CartLink } from "./cart/CartLink";
import { getSettings } from "@/lib/settings";
import { formatPhone } from "@/lib/phone";

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
        <div className="ml-auto sm:ml-0"><CartLink /></div>
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

const FOOTER_LINKS = ["delivery", "returns", "warranty", "terms", "privacy", "contact"] as const;
const FOOTER_TITLES = { delivery: "legal.delivery", returns: "legal.returns", warranty: "legal.warranty",
                        terms: "legal.terms", privacy: "legal.privacy", contact: "legal.contact" } as const;

export async function Footer() {
  const { contact } = await getSettings();
  const phone = contact.phone ? formatPhone(contact.phone) : null;
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 text-sm sm:grid-cols-[1fr_2fr]">
        <div>
          <p className="mb-2 font-semibold">{t("footer.info")}</p>
          <ul className="space-y-1">
            {FOOTER_LINKS.map((s) => (
              <li key={s}><Link href={`/info/${s}`} className="text-ink-2 hover:text-ink">{t(FOOTER_TITLES[s])}</Link></li>
            ))}
          </ul>
        </div>
        <div className="space-y-2 text-xs text-ink-2">
          {(phone || contact.email || contact.hours) && (
            <p className="text-sm text-ink" data-testid="footer-contact">
              {phone && <a href={`tel:${contact.phone!.replace(/[^\d+]/g, "")}`} className="mr-3 font-semibold">{phone}</a>}
              {contact.email && <a href={`mailto:${contact.email}`} className="mr-3 underline">{contact.email}</a>}
              {contact.hours && <span className="text-ink-2">{contact.hours}</span>}
            </p>
          )}
          <p>{t("footer.payments")}</p>
          <p>{t("footer.note")}</p>
        </div>
      </div>
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
