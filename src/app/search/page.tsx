import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getIndex, getNavigation } from "@/lib/catalog";
import { Listing, ListingSkeleton } from "@/components/Listing";
import { Breadcrumbs } from "@/components/Header";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("search.title"), robots: { index: false, follow: true } };

async function SearchContent({ searchParams }: { searchParams: PageProps<"/search">["searchParams"] }) {
  const params = await searchParams;
  const q = (Array.isArray(params.q) ? params.q[0] : params.q)?.trim();
  const { visible } = await getIndex();
  if (!q) {
    const nav = await getNavigation();
    return <>
      <Breadcrumbs items={[{ href: "/", label: t("nav.home") }, { label: t("search.title") }]} />
      <div className="mb-8 max-w-2xl"><h1 className="text-3xl font-bold leading-snug">{t("search.prompt")}</h1><p className="mt-3 text-base leading-7 text-ink-2">{t("search.help")}</p></div>
      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-8"><h2 className="mb-5 text-lg font-semibold">{t("search.popular")}</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{nav.map((category) => <Link key={category.id} href={`/catalog/${category.slug}`} className="flex min-h-16 items-center justify-between gap-4 rounded-xl border border-line bg-bg/60 px-4 py-4 text-base font-medium transition-colors hover:border-accent hover:text-accent"><span>{category.name}</span><span className="text-sm font-normal tabular-nums text-ink-2">{category.count}</span></Link>)}</div></section>
    </>;
  }
  return <>
    <Breadcrumbs items={[{ href: "/", label: t("nav.home") }, { label: t("search.title") }]} />
    <div className="mb-7"><p className="mb-2 text-sm text-ink-2">{t("search.heading")}</p><h1 className="break-words text-2xl font-bold leading-snug sm:text-3xl">„{q}“</h1></div>
    <Listing base={visible} types={[]} pathname="/search" searchParams={searchParams} />
  </>;
}

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return <Suspense fallback={<ListingSkeleton />}><SearchContent searchParams={searchParams} /></Suspense>;
}
