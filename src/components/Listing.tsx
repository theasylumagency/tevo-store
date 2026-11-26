import Link from "next/link";
import { getIndex } from "@/lib/catalog";
import { applyQuery, buildFacets, facetValues, getSearchResult, parseQuery, type SearchParams } from "@/lib/catalog/filters";
import { activeFilterCount, listingHref, withoutFilters, type FacetRecord } from "@/lib/catalog/filter-state";
import type { Product, ProductType } from "@/lib/catalog";
import { t } from "@/i18n";
import { Filters } from "./Filters";
import { ProductGrid } from "./ProductGrid";

/** Reads URL state within Suspense; the product grid stays server rendered. */
export async function Listing({ base, types, pathname, searchParams }: {
  base: Product[]; types: ProductType[]; pathname: string; searchParams: Promise<SearchParams>;
}) {
  const [{ catalog, brands }, params] = await Promise.all([getIndex(), searchParams]);
  const query = parseQuery(params, catalog);
  const search = getSearchResult(base, query, catalog);
  const products = applyQuery(base, query, catalog);
  const facets = buildFacets(base, types, query, catalog, brands);
  const ids = new Set(search.products.map(({ item }) => item.id));
  const searched = base.filter((product) => ids.has(product.id));
  const availableTypes = catalog.product_types.filter((type) => searched.some((product) => product.product_type === type.id));
  // Mobile drafts can change type before navigation. Send only the facet definitions and
  // values needed to show that type's controls immediately, keeping the catalog server-side.
  const typeFacets = Object.fromEntries(availableTypes.map((type) => [type.id,
    buildFacets(searched.filter((product) => product.product_type === type.id), [type],
      { filters: {}, sort: "default" }, catalog, brands)
      .filter((facet) => !["type", "brand", "price"].includes(facet.key)),
  ]));
  const keys = [...new Set(["type", "brand", ...facets.map((facet) => facet.key),
    ...Object.values(typeFacets).flatMap((group) => group.map((facet) => facet.key)),
    ...Object.keys(query.filters)])].filter((key) => key !== "price");
  const records: FacetRecord[] = searched.map((product) => ({
    id: product.id,
    price: product.price.promo ?? product.price.base,
    values: Object.fromEntries(keys.map((key) => [key, facetValues(product, key)])),
  }));
  const filtered = activeFilterCount(query) > 0;
  const clearHref = listingHref(pathname, withoutFilters(query));
  const corrections = query.q && search.correction && search.correction.toLowerCase() !== query.q.toLowerCase();

  return (
    <>
      {corrections && <div role="status" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/15 bg-accent-soft px-5 py-4 text-sm">
        <p className="text-ink">{t("search.corrected")} <Link href={listingHref(pathname, { ...query, q: search.correction!, exact: undefined })} className="font-semibold text-accent underline underline-offset-4">„{search.correction}“</Link></p>
        <Link href={listingHref(pathname, { ...query, exact: true })} className="inline-flex min-h-11 items-center text-ink-2 underline underline-offset-4 hover:text-ink">{t("search.original", { q: query.q! })}</Link>
      </div>}
      {query.exact && query.q && <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-2"><p>{t("search.exact_mode")}</p><Link href={listingHref(pathname, { ...query, exact: undefined })} className="inline-flex min-h-11 items-center font-medium text-accent underline underline-offset-4">{t("search.allow_correction")}</Link></div>}
      <Filters key={pathname} facets={facets} typeFacets={typeFacets}
        defaultType={availableTypes.length === 1 ? availableTypes[0].id : undefined}
        records={records} pathname={pathname} query={query} resultCount={products.length}>
        {products.length ? <ProductGrid products={products} cols={3} /> : (
          <div className="rounded-2xl border border-line bg-surface px-6 py-12 text-center sm:px-10 sm:py-16">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-bg text-ink-2"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg></div>
            <h2 className="text-xl font-semibold">{t(query.q && !search.total ? "search.no_results_title" : "listing.empty_title")}</h2>
            <p className="mx-auto mt-3 max-w-lg text-base leading-7 text-ink-2">{query.q ? (search.total ? t("search.no_results_filters") : t("search.no_results_query", { q: query.q })) : t("listing.empty_help")}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {filtered && <Link href={clearHref} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-ink">{t("listing.reset")}</Link>}
              <Link href="/search" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-line bg-surface px-5 py-3 text-sm font-medium hover:border-accent">{t("search.edit")}</Link>
              <Link href="/#catalog" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-line px-5 py-3 text-sm font-medium hover:border-accent">{t("search.catalog")}</Link>
            </div>
          </div>
        )}
      </Filters>
    </>
  );
}

export function ListingSkeleton() {
  return (
    <div aria-label={t("filters.updating")} aria-busy="true" className="grid gap-7 lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-8">
      <div className="hidden h-[34rem] animate-pulse rounded-2xl bg-line/40 motion-reduce:animate-none lg:block" />
      <div><div className="mb-5 h-[76px] animate-pulse rounded-2xl bg-line/40 motion-reduce:animate-none" /><div className="grid grid-cols-2 gap-4 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="aspect-[3/4] animate-pulse rounded-2xl bg-line/40 motion-reduce:animate-none" />)}</div></div>
    </div>
  );
}
