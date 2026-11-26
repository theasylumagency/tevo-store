import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { fromSlug, getIndex, getNavigation } from "@/lib/catalog";
import { Listing, ListingSkeleton } from "@/components/Listing";
import { Breadcrumbs } from "@/components/Header";
import { t } from "@/i18n";

export async function generateStaticParams() {
  return (await getNavigation()).flatMap((c) => c.types.map((ty) => ({ category: c.slug, type: ty.slug })));
}

export async function generateMetadata({ params }: PageProps<"/catalog/[category]/[type]">): Promise<Metadata> {
  const { category, type } = await params;
  return { title: (await getIndex()).types.get(fromSlug(type))?.name_plural, alternates: { canonical: `/catalog/${category}/${type}` } };
}

async function TypeContent({ params, searchParams }: PageProps<"/catalog/[category]/[type]">) {
  const { category, type } = await params;
  const { visible, types, categories } = await getIndex();
  const ty = types.get(fromSlug(type));
  const cat = categories.get(fromSlug(category));
  if (!ty || !cat || ty.category !== cat.id) notFound();
  const base = visible.filter((p) => p.product_type === ty.id);
  if (!base.length) notFound();

  return (
    <>
      <Breadcrumbs items={[{ href: "/", label: t("nav.home") }, { href: `/catalog/${category}`, label: cat.name },
                           { label: ty.name_plural }]} />
      <h1 className="mb-6 text-2xl font-bold">{ty.name_plural}</h1>
      <Suspense fallback={<ListingSkeleton />}>
        <Listing base={base} types={[ty]} pathname={`/catalog/${category}/${type}`} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

/**
 * params are awaited inside <Suspense>: with Partial Prefetching this is what lets Next build the
 * App Shell for this route and re-render pages in the background after POST /api/revalidate.
 * Unknown slugs never get here — the proxy answers them with a real 404.
 */
export default function TypePage(props: PageProps<"/catalog/[category]/[type]">) {
  return (
    <Suspense fallback={<ListingSkeleton />}>
      <TypeContent {...props} />
    </Suspense>
  );
}
