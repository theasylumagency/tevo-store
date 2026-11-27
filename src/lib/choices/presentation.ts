import type { Catalog } from "../catalog/types";
import { productImages } from "../catalog/product-presentation";
import { cleanChoiceIds, type ChoiceResult } from "./types";

const slug = (id: string) => id.toLowerCase().replace(/_/g, "-");

/** Resolve saved identifiers afresh; a browser snapshot never supplies product facts. */
export function resolveChoiceProducts(input: unknown, catalog: Catalog, available: ReadonlySet<string>): ChoiceResult {
  const ids = cleanChoiceIds(input);
  const byId = new Map(catalog.products.filter((p) => p.visible).map((p) => [p.id, p]));
  const brands = new Map(catalog.brands.map((b) => [b.id, b.name]));
  const types = new Map(catalog.product_types.map((t) => [t.id, t]));
  return {
    missingIds: ids.filter((id) => !byId.has(id)),
    products: ids.flatMap((id) => {
      const p = byId.get(id);
      if (!p) return [];
      return [{
        id: p.id, slug: p.slug, name: p.name, model: p.model,
        brand: p.brand ? brands.get(p.brand) ?? p.brand : null,
        productType: p.product_type,
        productTypeLabel: types.get(p.product_type)?.name_plural ?? p.product_type,
        typeHref: `/catalog/${slug(p.category)}/${slug(p.product_type)}`,
        price: { ...p.price }, availability: p.availability.status,
        image: productImages(p.media, available)[0]?.src ?? null,
        // Select presentation fields explicitly: provenance/review data stays on the server.
        specs: p.specs.map(({ key, label, value, unit, num, num_max }) => ({ key, label, value, unit, num, num_max })),
        attributes: Object.entries(p.attributes).flatMap(([key, value]) => {
          const definition = catalog.attribute_vocabulary[key];
          return definition ? [{ key, label: definition.label, value }] : [];
        }),
      }];
    }),
  };
}
