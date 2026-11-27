import type { Product } from "@/lib/catalog/types";
import type { Block, HomeDocument } from "./model";

export function homeSelection(doc: HomeDocument, visible: Product[], sales: string[], offerOpen: boolean) {
  const byId = new Map(visible.map(p => [p.id, p]));
  const byIds = (ids: string[]) => ids.flatMap(id => byId.get(id) ?? []).slice(0, 8);
  const picks = doc.picks.mode === "manual" ? byIds(doc.picks.ids) :
    visible.filter(p => p.product_type === doc.picks.type).sort((a, b) =>
      Number(b.data_quality.score >= 70) - Number(a.data_quality.score >= 70)).slice(0, 8);
  const popular = byIds(sales);
  const offer = offerOpen ? visible.find(p => (!doc.offer.product || p.id === doc.offer.product) &&
    p.availability.status !== "out_of_stock" && p.price.promo !== null && p.price.base !== null && p.price.promo < p.price.base) : undefined;
  const sections: { key: Block; fallback: boolean }[] = [];
  for (const key of doc.layouts[doc.preset]) {
    const missingOffer = key === "offer" && !offer;
    if (missingOffer && doc.offer.fallback === "hide") continue;
    const fallback = missingOffer || (key === "popular" && !popular.length);
    const resolved = fallback ? "picks" : key;
    if (resolved === "picks" && !picks.length || sections.some(s => s.key === resolved)) continue;
    sections.push({ key: resolved, fallback });
  }
  return { offer, picks, popular, sections };
}
