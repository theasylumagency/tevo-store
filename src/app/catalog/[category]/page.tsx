import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { fromSlug, getIndex, getNavigation, toSlug } from "@/lib/catalog";
import { Listing, ListingSkeleton } from "@/components/Listing";
import { Breadcrumbs } from "@/components/Header";
import { t } from "@/i18n";

export async function generateStaticParams() {
  return (await getNavigation()).map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/catalog/[category]">): Promise<Metadata> {
  const { category } = await params;
  const c = (await getIndex()).categories.get(fromSlug(category));
  return { title: c?.name };
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/catalog/[category]">) {
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
      <h1 className="mb-3 text-2xl font-bold">{cat.name}</h1>
      <div className="mb-6 flex flex-wrap gap-2">
        {cat.types.map((ty) => (
          <Link key={ty.id} href={`/catalog/${cat.slug}/${toSlug(ty.id)}`}
                className="rounded-full border border-line bg-surface px-3 py-1 text-sm hover:border-accent">
            {ty.name} <span className="text-ink-2">{ty.count}</span>
          </Link>
        ))}
      </div>
      <Suspense fallback={<ListingSkeleton />}>
        <Listing base={base} types={catTypes} pathname={`/catalog/${cat.slug}`} searchParams={searchParams} />
      </Suspense>
    </>
  );
}
