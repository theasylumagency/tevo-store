import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LEGAL, LEGAL_SLUGS, type LegalSlug } from "@/content/legal";
import { LegalText } from "@/components/LegalText";
import { getStore } from "@/config/store";
import { t } from "@/i18n";


export function generateStaticParams() {
  return LEGAL_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/info/[slug]">): Promise<Metadata> {
  const page = LEGAL[(await params).slug as LegalSlug];
  return page ? { title: t(page.title) } : {};
}

export default async function InfoPage({ params }: PageProps<"/info/[slug]">) {
  const { slug } = await params;
  const page = LEGAL[slug as LegalSlug];
  if (!page) notFound();
  const store = getStore();
  return (
    <div className="grid gap-8 md:grid-cols-[220px_1fr]">
      <nav className="space-y-1 text-sm">
        {LEGAL_SLUGS.map((s) => (
          <Link key={s} href={`/info/${s}`}
                className={`block rounded px-2 py-1.5 ${s === slug ? "bg-accent-soft text-accent" : "text-ink-2 hover:text-ink"}`}>
            {t(LEGAL[s].title)}
          </Link>
        ))}
      </nav>
      <article className="max-w-3xl">
        <h1 className="mb-2 text-2xl font-bold">{t(page.title)}</h1>
        <p className="mb-4 text-xs text-ink-2">{t("legal.version", { v: store.termsVersion })}</p>
        {!store.legalReviewed && (
          <p className="mb-6 rounded-card border border-warn/40 bg-warn-soft px-3 py-2 text-sm text-warn">{t("legal.draft")}</p>
        )}
        <LegalText blocks={page.blocks} store={store} />
      </article>
    </div>
  );
}
