import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { brandName, getIndex, getProductBySlug, getRelated, toSlug } from "@/lib/catalog";
import { getAvailableMedia } from "@/lib/media";
import { getStore } from "@/config/store";
import { Breadcrumbs } from "@/components/Header";
import { Gallery } from "@/components/Gallery";
import { Price } from "@/components/Price";
import { Description, ReviewPanel, SpecTable } from "@/components/ProductDetails";
import { ProductGrid } from "@/components/ProductGrid";
import { t, type MessageKey } from "@/i18n";

export async function generateStaticParams() {
  return (await getIndex()).visible.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const p = await getProductBySlug((await params).slug);
  return p ? { title: p.name, description: p.subtitle ?? undefined } : {};
}

export default async function ProductPage({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) notFound();
  const [{ catalog, types, categories }, media, related, brand] = await Promise.all([
    getIndex(), getAvailableMedia(), getRelated(p), brandName(p.brand),
  ]);
  const store = getStore();
  const have = new Set(media);
  const images = p.media.filter((m) => have.has(m.file)).map((m) => ({ src: `/media/${m.file}` }));
  const type = types.get(p.product_type)!;
  const cat = categories.get(p.category)!;
  const code = p.codes.supplier ?? p.codes.ean;

  return (
    <article className="space-y-10">
      <div>
        <Breadcrumbs items={[
          { href: "/", label: t("nav.home") },
          { href: `/catalog/${toSlug(cat.id)}`, label: cat.name },
          { href: `/catalog/${toSlug(cat.id)}/${toSlug(type.id)}`, label: type.name_plural },
          { label: p.name },
        ]} />
        <div className="grid gap-8 lg:grid-cols-2">
          <Gallery images={images} alt={p.name} emptyLabel={t("product.no_photo")} />
          <div className="space-y-5">
            <div>
              {brand && <p className="text-sm uppercase tracking-wide text-ink-2">{brand}</p>}
              <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{p.name}</h1>
              {p.subtitle && <p className="mt-1 text-ink-2">{p.subtitle}</p>}
            </div>
            <div className="rounded-card border border-line bg-surface p-4">
              <Price price={p.price} size="lg" />
              <p className="mt-1 text-xs text-ink-2">{t(`product.availability.${p.availability.status}` as MessageKey)}</p>
              <button disabled title={t("product.buy.soon")}
                      className="mt-4 w-full cursor-not-allowed rounded-card bg-accent px-4 py-3 font-medium text-accent-ink opacity-60">
                {t("product.buy")}
              </button>
              <p className="mt-2 text-center text-xs text-ink-2">{t("product.buy.soon")}</p>
            </div>
            {p.features.length > 0 && (
              <ul className="space-y-1 text-sm">
                {p.features.map((f) => <li key={f} className="flex gap-2"><span className="text-accent">✓</span>{f}</li>)}
              </ul>
            )}
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              {p.model && <><dt className="text-ink-2">{t("product.model")}</dt><dd>{p.model}</dd></>}
              {code && <><dt className="text-ink-2">{t("product.code")}</dt><dd className="font-mono text-xs leading-5">{code}</dd></>}
            </dl>
            {p.compatibility?.note && (
              <p className="rounded-card bg-accent-soft px-3 py-2 text-sm">
                <span className="font-medium">{t("product.compatibility")}:</span> {p.compatibility.note}
              </p>
            )}
            {store.showReview && <ReviewPanel product={p} catalog={catalog} />}
          </div>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-semibold">{t("product.specs")}</h2>
          <SpecTable product={p} catalog={catalog} />
        </section>
        {p.description && (
          <section>
            <h2 className="mb-3 text-lg font-semibold">{t("product.description")}</h2>
            <Description text={p.description} />
          </section>
        )}
      </div>

      {p.videos.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">{t("product.videos")}</h2>
          <ul className="space-y-1 text-sm">
            {p.videos.map((v) => <li key={v}><Link href={v} className="text-accent underline" target="_blank" rel="noopener">{v}</Link></li>)}
          </ul>
        </section>
      )}

      {related.map((g) => (
        <section key={g.type}>
          <h2 className="mb-3 text-lg font-semibold">{t(`rel.${g.type}` as MessageKey)}</h2>
          <ProductGrid products={g.products} />
        </section>
      ))}
    </article>
  );
}
