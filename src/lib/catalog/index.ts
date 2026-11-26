import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { readPublication } from "./published";
import type { Catalog, Category, Product, ProductType, RelationType } from "./types";

export * from "./types";

export const toSlug = (id: string) => id.toLowerCase().replace(/_/g, "-");
export const fromSlug = (slug: string) => slug.toUpperCase().replace(/-/g, "_");

/** Whole catalog, cached. Everything else derives from it. */
export async function getCatalog(): Promise<Catalog> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");   // POST /api/revalidate refreshes it without a rebuild
  return readPublication();
}

export interface CatalogIndex {
  catalog: Catalog;
  byId: Map<string, Product>;
  bySlug: Map<string, Product>;
  types: Map<string, ProductType>;
  categories: Map<string, Category>;
  brands: Map<string, string>;
  visible: Product[];
}

// The catalog is a few hundred products: index it once per process.
let memo: { key: string; index: CatalogIndex } | null = null;

export async function getIndex(): Promise<CatalogIndex> {
  const catalog = await getCatalog();
  return indexCatalog(catalog);
}

export function indexCatalog(catalog: Catalog): CatalogIndex {
  const key = catalog.generated_at + catalog.products.length;
  if (memo?.key === key) return memo.index;
  const index: CatalogIndex = {
    catalog,
    byId: new Map(catalog.products.map((p) => [p.id, p])),
    bySlug: new Map(catalog.products.map((p) => [p.slug, p])),
    types: new Map(catalog.product_types.map((t) => [t.id, t])),
    categories: new Map(catalog.categories.map((c) => [c.id, c])),
    brands: new Map(catalog.brands.map((b) => [b.id, b.name])),
    visible: catalog.products.filter((p) => p.visible),
  };
  memo = { key, index };
  return index;
}

export async function getNavigation() {
  const { catalog, visible, types } = await getIndex();
  return catalog.categories
    .map((c) => ({
      ...c,
      slug: toSlug(c.id),
      count: visible.filter((p) => p.category === c.id).length,
      types: c.product_types
        .map((t) => ({
          id: t,
          slug: toSlug(t),
          name: types.get(t)?.name_plural ?? t,
          count: visible.filter((p) => p.product_type === t).length,
        }))
        .filter((t) => t.count > 0),
    }))
    .filter((c) => c.count > 0);
}

export async function getProductBySlug(slug: string) {
  const { bySlug } = await getIndex();
  const p = bySlug.get(slug);
  return p && p.visible ? p : undefined;
}

export const RELATION_ORDER: RelationType[] = ["variant", "spare_part", "accessory", "consumable", "fits", "same_size"];

export async function getRelated(product: Product, perGroup = 8) {
  const { byId } = await getIndex();
  const groups = new Map<RelationType, Product[]>();
  for (const r of product.relations) {
    const target = byId.get(r.product_id);
    if (!target || !target.visible) continue;
    const list = groups.get(r.type) ?? [];
    if (list.length < perGroup && !list.some((x) => x.id === target.id)) list.push(target);
    groups.set(r.type, list);
  }
  return RELATION_ORDER.filter((t) => groups.get(t)?.length).map((t) => ({ type: t, products: groups.get(t)! }));
}

export async function brandName(id: string | null) {
  if (!id) return null;
  return (await getIndex()).brands.get(id) ?? id;
}

export function spec(p: Product, key: string) {
  return p.specs.find((s) => s.key === key);
}

export function mainImage(p: Product) {
  return p.media.find((m) => m.role === "main") ?? p.media[0];
}
