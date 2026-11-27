import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getIndex, getNavigation } from "@/lib/catalog";
import { Listing, ListingSkeleton } from "@/components/Listing";
import { Breadcrumbs } from "@/components/Header";
import { t } from "@/i18n";
import ui from "@/components/storefront/foundation.module.css";
import css from "@/components/storefront/catalog.module.css";

export const metadata: Metadata = { title: "კატალოგი და ძიება", robots: { index: false, follow: true } };

async function SearchContent({ searchParams }: { searchParams: PageProps<"/search">["searchParams"] }) {
  const params = await searchParams;
  const q = (Array.isArray(params.q) ? params.q[0] : params.q)?.trim();
  const { visible } = await getIndex();
  if (!q) {
    const nav = await getNavigation();
    return <>
      <Breadcrumbs items={[{ href: "/", label: t("nav.home") }, { label: "კატალოგი" }]} />
      <header className={css.pageHead}><h1 className={ui.pageTitle}>კატალოგი</h1><p className={ui.lead}>აირჩიე კატეგორია ან ძიების ველში ჩაწერე პროდუქტი, ბრენდი თუ მოდელი.</p></header>
      {nav.length > 0
        ? <section aria-labelledby="search-directory-title"><h2 id="search-directory-title" className={`${ui.sectionTitle} mb-5`}>{t("search.popular")}</h2><div className={css.directory}>{nav.map((category) => <Link key={category.id} href={`/catalog/${category.slug}`} className={css.directoryLink}><span>{category.name}</span><span aria-label={`${category.count} პროდუქტი`}>{category.count}</span></Link>)}</div></section>
        : <section className={ui.state} aria-labelledby="empty-catalog-title">
          <h2 id="empty-catalog-title" className={ui.stateTitle}>პროდუქტები ჯერ არ ჩანს</h2>
          <p className={ui.stateCopy}>გთხოვ, მოგვიანებით სცადო ან დაგვიკავშირდე პროდუქტის შესარჩევად.</p>
          <Link href="/info/contact" className={ui.primaryAction}>დაგვიკავშირდი</Link>
        </section>}
    </>;
  }
  return <>
    <Breadcrumbs items={[{ href: "/", label: t("nav.home") }, { label: t("search.title") }]} />
    <header className={css.pageHead}><p className={ui.eyebrow}>{t("search.heading")}</p><h1 className={ui.pageTitle}>„{q}“</h1></header>
    <Listing base={visible} types={[]} pathname="/search" searchParams={searchParams} />
  </>;
}

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return <Suspense fallback={<ListingSkeleton />}><SearchContent searchParams={searchParams} /></Suspense>;
}
