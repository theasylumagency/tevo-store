import { effectivePrice, type PriceOrigin, type PriceRule } from "./publication";
import type { Catalog, Product } from "./types";

type Price = Product["price"];
export function samePrice(a: Price | undefined, b: Price | undefined) {
  return a?.base === b?.base && a?.promo === b?.promo;
}

export function pricingImpact(
  row: { source: Catalog; published: Catalog; pricing: Record<string, PriceOrigin> },
  proposed: PriceRule | null,
) {
  const sources = new Map(row.source.products.map(p => [p.id, p.price]));
  return row.published.products.map(product => {
    const source = sources.get(product.id)!;
    const applied = row.pricing[product.id];
    const exception = applied.origin === "product";
    const after = effectivePrice(source, exception ? applied.rule : proposed);
    return { id: product.id, name: product.name, visible: product.visible, exception,
      promotion: source.promo !== null, source, before: product.price, after,
      changed: !samePrice(product.price, after) };
  });
}
