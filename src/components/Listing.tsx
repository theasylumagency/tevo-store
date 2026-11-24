import { getIndex } from "@/lib/catalog";
import { applyQuery, buildFacets, parseQuery, SORTS, type SearchParams } from "@/lib/catalog/filters";
import type { Product, ProductType } from "@/lib/catalog";
import { t } from "@/i18n";
import { Filters } from "./Filters";
import { ProductGrid } from "./ProductGrid";

/** Reads searchParams (runtime data) — always render inside <Suspense>. */
export async function Listing({ base, types, pathname, searchParams }: {
  base: Product[];
  types: ProductType[];
  pathname: string;
  searchParams: Promise<SearchParams>;
}) {
  const [{ catalog, brands }, sp] = await Promise.all([getIndex(), searchParams]);
  const q = parseQuery(sp);
  const products = applyQuery(base, q, catalog);
  const facets = buildFacets(base, types, q, catalog, brands);
  const sorts = Object.fromEntries(SORTS.map((s) => [s, t(`sort.${s}`)])) as Record<(typeof SORTS)[number], string>;

  return (
    <div className="grid gap-6 md:grid-cols-[220px_1fr]">
      <Filters facets={facets} pathname={pathname} current={q.filters} sort={q.sort} q={q.q}
               labels={{ title: t("filters.title"), from: t("filters.from"), to: t("filters.to"),
                         apply: t("filters.apply"), reset: t("listing.reset"), sort: t("sort.label"), sorts }} />
      <section>
        <p className="mb-3 text-sm text-ink-2">{t("listing.products", { n: products.length })}</p>
        {products.length ? <ProductGrid products={products} cols={3} /> : (
          <p className="rounded-card border border-dashed border-line p-8 text-center text-ink-2">{t("listing.empty")}</p>
        )}
      </section>
    </div>
  );
}

export function ListingSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-[220px_1fr]">
      <div className="h-64 animate-pulse rounded-card bg-line/40" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-card bg-line/40" />)}
      </div>
    </div>
  );
}
