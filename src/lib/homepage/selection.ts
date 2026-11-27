import type { Catalog, Category, Product } from "@/lib/catalog/types";
import { normalizeHome, type Block, type HomeCollection, type HomeDocument, type HomeTarget } from "./model";

const slug = (value: string) => value.toLowerCase().replace(/_/g, "-");
export const homePrice = (p: Product) => p.price.promo ?? p.price.base;
export function homeEligible(p: Product) {
  const price = homePrice(p);
  return p.visible && p.availability.status !== "out_of_stock" && price !== null && Number.isFinite(price) && price > 0;
}
export function genuineOffer(p: Product) {
  return homeEligible(p) && p.price.base !== null && p.price.promo !== null && p.price.promo < p.price.base;
}

/** Manual lists preserve editorial order; dynamic lists replenish only within their own rule. */
export function selectCollection(collection: HomeCollection, products: Product[]): Product[] {
  const eligible = products.filter(p => homeEligible(p) && (!collection.onlyInStock ||
    p.availability.status === "in_stock" || p.availability.status === "low_stock") &&
    (collection.sort !== "offers" || genuineOffer(p)));
  const byId = new Map(eligible.map(p => [p.id, p]));
  if (collection.mode === "manual") return collection.ids.flatMap(id => byId.get(id) ?? []).slice(0, collection.limit);
  const matches = eligible.filter(p => p.product_type === collection.type);
  if (collection.sort === "price_asc" || collection.sort === "price_desc") {
    const direction = collection.sort === "price_asc" ? 1 : -1;
    matches.sort((a, b) => direction * ((homePrice(a) ?? 0) - (homePrice(b) ?? 0)) || a.id.localeCompare(b.id));
  }
  return matches.slice(0, collection.limit);
}

export function featuredCategories<T extends Pick<Category, "id">>(ids: string[], categories: T[]): T[] {
  if (!ids.length) return categories;
  const byId = new Map(categories.map(c => [c.id, c]));
  return ids.flatMap(id => byId.get(id) ?? []);
}

/** Targets are catalog entities, never an administrator-supplied URL. */
export function resolveHomeTarget(target: HomeTarget, catalog: Catalog): string | null {
  if (target.kind === "none") return null;
  if (target.kind === "catalog") return "/search";
  const visible = catalog.products.filter(homeEligible);
  if (target.kind === "product") {
    const p = visible.find(p => p.id === target.value);
    return p ? "/p/" + p.slug : null;
  }
  if (target.kind === "category") {
    const category = catalog.categories.find(c => c.id === target.value);
    return category && visible.some(p => p.category === category.id) ? "/catalog/" + slug(category.id) : null;
  }
  const type = catalog.product_types.find(t => t.id === target.value);
  return type && visible.some(p => p.product_type === type.id) ? "/catalog/" + slug(type.category) + "/" + slug(type.id) : null;
}

export function homeSelection(input: HomeDocument, products: Product[], sales: string[], offerOpen: boolean) {
  const doc = normalizeHome(input);
  const eligible = products.filter(homeEligible);
  const byId = new Map(eligible.map(p => [p.id, p]));
  const picks = selectCollection(doc.picks, products);
  const seasonal = selectCollection(doc.seasonal, products);
  const popular = sales.flatMap(id => byId.get(id) ?? []).slice(0, 8);
  const offer = offerOpen ? eligible.find(p => (!doc.offer.product || p.id === doc.offer.product) && genuineOffer(p)) : undefined;
  const sections: { key: Block; fallback: boolean }[] = [];
  for (const key of doc.layouts[doc.preset]) {
    const missingOffer = key === "offer" && !offer;
    if (missingOffer && doc.offer.fallback === "hide") continue;
    const fallback = missingOffer || (key === "popular" && !popular.length);
    const resolved = fallback ? "picks" : key;
    if (resolved === "picks" && !picks.length || resolved === "seasonal" && !seasonal.length ||
      resolved === "guide" && !doc.guide.tasks.some(t => t.title.trim() && eligible.some(p => p.product_type === t.type)) ||
      resolved === "advice" && (!doc.advice.title.trim() || !doc.advice.text.trim() || doc.advice.target.kind === "none") ||
      resolved === "service" && !doc.service.items.length || sections.some(s => s.key === resolved)) continue;
    sections.push({ key: resolved, fallback });
  }
  return { offer, picks, seasonal, popular, sections };
}
