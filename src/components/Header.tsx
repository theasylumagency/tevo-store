import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { getIndex, getNavigation } from "@/lib/catalog";
import { getStore } from "@/config/store";
import { t } from "@/i18n";
import { getSettings } from "@/lib/settings";
import { formatPhone } from "@/lib/phone";
import { createSearchIndex } from "@/lib/catalog/search";
import { availablePaymentMethods, paymentsMode } from "@/lib/payments/providers";
import { StoreNavigation } from "./StoreNavigation";

export async function Header() {
  const store = getStore();
  const [nav, { catalog, visible }] = await Promise.all([getNavigation(), getIndex()]);
  return (
    <header className="relative z-30 border-b border-line bg-surface">
      {store.showReview && (
        <div className="bg-warn-soft px-4 py-2 text-center text-sm leading-5 text-warn">{t("review.banner")}</div>
      )}
      <StoreNavigation storeName={store.name} nav={nav} searchIndex={createSearchIndex(catalog, visible)} />
    </header>
  );
}

const FOOTER_LINKS = ["delivery", "returns", "warranty", "terms", "privacy", "contact"] as const;
const FOOTER_TITLES = { delivery: "legal.delivery", returns: "legal.returns", warranty: "legal.warranty",
                        terms: "legal.terms", privacy: "legal.privacy", contact: "legal.contact" } as const;

/** Match the checkout's runtime payment capabilities, including production payments-off mode. */
async function PaymentNote() {
  await connection();
  const store = getStore();
  const methods = availablePaymentMethods(store.id, store.paymentMethods);
  if (paymentsMode() === "test") return <p>{t("footer.payments.test")}</p>;
  const online = methods.filter((method) => method !== "cash");
  return <div className="space-y-2">
    {methods.length > 0 && <p>{t("footer.payments.available")} {methods.map((method) => t(`checkout.payment.${method}`)).join(" · ")}</p>}
    {online.length > 0 ? <p>{t("footer.payments.secure")}</p> : <p>{t("footer.payments.offline")}</p>}
  </div>;
}

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
        <div className="space-y-2 text-sm leading-6 text-ink-2">
          {(phone || contact.email || contact.hours) && (
            <p className="text-sm text-ink" data-testid="footer-contact">
              {phone && <a href={`tel:${contact.phone!.replace(/[^\d+]/g, "")}`} className="mr-3 font-semibold">{phone}</a>}
              {contact.email && <a href={`mailto:${contact.email}`} className="mr-3 underline">{contact.email}</a>}
              {contact.hours && <span className="text-ink-2">{contact.hours}</span>}
            </p>
          )}
          <Suspense fallback={<p>{t("footer.payments.hint")}</p>}><PaymentNote /></Suspense>
          <p>{t("footer.note")}</p>
        </div>
      </div>
    </footer>
  );
}

export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label={t("nav.breadcrumbs")} className="mb-4 flex flex-wrap items-center gap-1 text-sm leading-6 text-ink-2">
      {items.map((it, i) => (
        <span key={i} className="flex gap-1">
          {i > 0 && <span>/</span>}
          {it.href ? <Link href={it.href} className="hover:text-ink">{it.label}</Link> : <span aria-current="page" className="text-ink">{it.label}</span>}
        </span>
      ))}
    </nav>
  );
}
