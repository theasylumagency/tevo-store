import Link from "next/link";
import { getIndex, getNavigation } from "@/lib/catalog";
import { ProductGrid } from "@/components/ProductGrid";
import { t } from "@/i18n";

export default async function Home() {
  const [nav, { visible }] = await Promise.all([getNavigation(), getIndex()]);
  const featured = visible
    .filter((p) => p.product_type === "MOTOBLOCK" && p.data_quality.score >= 70)
    .slice(0, 8);

  return (
    <div className="space-y-12">
      <section className="rounded-card border border-line bg-surface px-6 py-10 sm:px-10">
        <h1 className="max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">{t("home.title")}</h1>
        <p className="mt-3 max-w-2xl text-ink-2">{t("home.lead")}</p>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">{t("home.categories")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {nav.map((c) => (
            <div key={c.id} className="rounded-card border border-line bg-surface p-4">
              <Link href={`/catalog/${c.slug}`} className="flex items-baseline justify-between font-medium hover:text-accent">
                <span>{c.name}</span><span className="text-xs text-ink-2">{c.count}</span>
              </Link>
              <ul className="mt-2 space-y-0.5 text-sm text-ink-2">
                {c.types.slice(0, 6).map((ty) => (
                  <li key={ty.id}>
                    <Link href={`/catalog/${c.slug}/${ty.slug}`} className="hover:text-ink">{ty.name}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {featured.length > 0 && (
        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">{t("home.featured")}</h2>
            <Link href="/catalog/agri-machinery/motoblock" className="text-sm text-accent">{t("home.all")} →</Link>
          </div>
          <ProductGrid products={featured} />
        </section>
      )}
    </div>
  );
}
