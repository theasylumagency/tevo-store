import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getIndex, getProductBySlug } from "@/lib/catalog";
import { getAvailableMedia } from "@/lib/media";
import { ProductView } from "@/components/ProductView";
import { StorefrontLoading } from "@/components/storefront/StorefrontLoading";

export async function generateStaticParams() {
  return (await getIndex()).visible.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const p = await getProductBySlug((await params).slug);
  if (!p) return {};
  const media = new Set(await getAvailableMedia());
  const img = p.media.find((m) => media.has(m.file));
  return {
    title: p.name,
    description: p.subtitle ?? undefined,
    alternates: { canonical: `/p/${p.slug}` },
    openGraph: { title: p.name, description: p.subtitle ?? undefined, url: `/p/${p.slug}`, ...(img ? { images: [`/media/${img.file}`] } : {}) },
  };
}

async function ProductContent({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) notFound();
  return <ProductView product={p} />;
}

/**
 * params are awaited inside <Suspense>: with Partial Prefetching this is what lets Next build the
 * App Shell for this route and re-render pages in the background after POST /api/revalidate.
 * Unknown slugs never get here — the proxy answers them with a real 404.
 */
export default function ProductPage(props: PageProps<"/p/[slug]">) {
  return (
    <Suspense fallback={<StorefrontLoading product />}>
      <ProductContent {...props} />
    </Suspense>
  );
}
