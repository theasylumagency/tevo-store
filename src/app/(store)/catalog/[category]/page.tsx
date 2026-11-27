import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { fromSlug, getIndex, getNavigation, toSlug } from "@/lib/catalog";
import { Listing, ListingSkeleton } from "@/components/Listing";
import { Breadcrumbs } from "@/components/Header";
import { t } from "@/i18n";
import ui from "@/components/storefront/foundation.module.css";
import css from "@/components/storefront/catalog.module.css";

export async function generateStaticParams() {
  return (await getNavigation()).map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/catalog/[category]">): Promise<Metadata> {
  const { category } = await params;
  const c = (await getIndex()).categories.get(fromSlug(category));
  return { title: c?.name, alternates: { canonical: `/catalog/${category}` } };   // filtered/sorted variants point here
}

async function CategoryContent({ params, searchParams }: PageProps<"/catalog/[category]">) {
  const { category } = await params;
  const nav = await getNavigation();
  const cat = nav.find((c) => c.slug === category);
  if (!cat) notFound();
  const { visible, types } = await getIndex();
  const base = visible.filter((p) => p.category === cat.id);
  const catTypes = cat.types.map((ty) => types.get(ty.id)!).filter(Boolean);

  return (
    <>
      <Breadcrumbs items={[{ href: "/", label: t("nav.home") }, { label: cat.name }]} />
      <header className={css.pageHead}>
        <h1 className={ui.pageTitle}>{cat.name}</h1>
        <p className={ui.lead}>აირჩიე პროდუქტის ტიპი ან შეადარე პროდუქტები ფასითა და მახასიათებლებით.</p>
      </header>
      <nav aria-label="პროდუქტის ტიპები" className={css.types}>
        {cat.types.map((ty) => (
          <Link key={ty.id} href={`/catalog/${cat.slug}/${toSlug(ty.id)}`}
                className={css.typeLink}>
            {ty.name} <span aria-label={`${ty.count} პროდუქტი`}>{ty.count}</span>
          </Link>
        ))}
      </nav>
      <Suspense fallback={<ListingSkeleton />}>
        <Listing base={base} types={catTypes} pathname={`/catalog/${cat.slug}`} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

/**
 * params are awaited inside <Suspense>: with Partial Prefetching this is what lets Next build the
 * App Shell for this route and re-render pages in the background after POST /api/revalidate.
 * Unknown slugs never get here — the proxy answers them with a real 404.
 */
export default function CategoryPage(props: PageProps<"/catalog/[category]">) {
  return (
    <Suspense fallback={<ListingSkeleton />}>
      <CategoryContent {...props} />
    </Suspense>
  );
}
