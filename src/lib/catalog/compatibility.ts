import type { Catalog, Product, RelationType } from "./types";

export interface CompatibilityField {
  key: "product_types" | "brands" | "tire_size" | "engine_model";
  label: string;
  value: string;
}

export interface CompatibilityLink {
  id: string;
  name: string;
  href: string;
  reason: string | null;
}

export interface CompatibilityPresentation {
  fields: CompatibilityField[];
  note: string | null;
  fits: CompatibilityLink[];
  fitCount: number;
  hasEvidence: boolean;
  show: boolean;
}

const COMPONENT_TYPES = new Set([
  "TRAILER", "AGRI_ATTACHMENT", "IRRIGATION_ACCESSORY", "TIRE", "TUBE",
  "WHEEL_RIM", "ENGINE", "SPARE_PART", "ACCESSORY", "CONSUMABLE",
]);

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
function distinctStrings(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.map(text).filter(Boolean))] : [];
}

/** A relation is evidence only for its own named meaning; never infer a reverse relation. */
export function relatedProductReasons(
  product: Pick<Product, "id" | "relations">,
  type: RelationType,
  products: readonly Product[],
  limit = 8,
): CompatibilityLink[] {
  const max = Number.isFinite(limit) ? Math.max(0, Math.trunc(limit)) : 8;
  if (!max) return [];
  const byId = new Map(products.filter((item) => item.visible && item.id !== product.id).map((item) => [item.id, item]));
  const result: CompatibilityLink[] = [];
  for (const relation of product.relations) {
    if (relation.type !== type || result.some((item) => item.id === relation.product_id)) continue;
    const target = byId.get(relation.product_id);
    if (!target) continue;
    result.push({ id: target.id, name: target.name, href: `/p/${target.slug}`, reason: text(relation.reason) || null });
    if (result.length >= max) break;
  }
  return result;
}

/** Structured source fields are shown faithfully, without expanding broad claims to individual models. */
export function productCompatibility(
  product: Pick<Product, "id" | "product_type" | "compatibility" | "relations">,
  catalog: Pick<Catalog, "product_types" | "brands" | "products">,
): CompatibilityPresentation {
  const typeNames = new Map(catalog.product_types.map((item) => [item.id, item.name_plural]));
  const brandNames = new Map(catalog.brands.map((item) => [item.id, item.name]));
  const source = product.compatibility;
  const fields: CompatibilityField[] = [];
  const types = distinctStrings(source?.product_types);
  const brands = distinctStrings(source?.brands);
  if (types.length) fields.push({ key: "product_types", label: "პროდუქტის ტიპი", value: types.map((id) => typeNames.get(id) ?? id).join(" · ") });
  if (brands.length) fields.push({ key: "brands", label: "მითითებული ბრენდები", value: brands.map((id) => brandNames.get(id) ?? id).join(" · ") });
  if (text(source?.tire_size)) fields.push({ key: "tire_size", label: "საბურავის ზომა", value: text(source?.tire_size) });
  if (text(source?.engine_model)) fields.push({ key: "engine_model", label: "ძრავის მოდელი", value: text(source?.engine_model) });
  const note = text(source?.note) || null;
  const allFits = relatedProductReasons(product, "fits", catalog.products, Number.MAX_SAFE_INTEGER);
  const hasEvidence = fields.length > 0 || note !== null || allFits.length > 0;
  return {
    fields, note, fits: allFits.slice(0, 4), fitCount: allFits.length,
    hasEvidence, show: hasEvidence || COMPONENT_TYPES.has(product.product_type),
  };
}

export const relationDescriptions: Record<RelationType, string> = {
  fits: "კატალოგში ამ პროდუქტთან დაკავშირებული მოდელები. თითოეულთან მითითებული მიზეზი ქვემოთ შეგიძლია ნახო; შეამოწმე შენი მოდელი და შეერთების პარამეტრები.",
  same_size: "ამ პროდუქტებს კატალოგში ერთი ზომა აქვთ მითითებული. ზომის დამთხვევა სრული თავსებადობის დადასტურება არ არის — შეამოწმე დანიშნულება და შეერთება.",
  variant: "კატალოგში დაკავშირებული სხვა ვარიანტები. მახასიათებლები და კომპლექტაცია შეიძლება განსხვავდებოდეს; ერთი მეორის პირდაპირ შემცვლელად არ მიიჩნევა.",
  spare_part: "კატალოგში ამ პროდუქტთან დაკავშირებული სათადარიგო ნაწილები. შერჩევისას შეადარე ზუსტი მოდელი, ნაწილის კოდი და ზომები.",
  accessory: "კატალოგში ამ პროდუქტთან დაკავშირებული დანადგარები და აქსესუარები. შეერთებისა და მონტაჟის მოთხოვნები კონკრეტულ პროდუქტთან გადაამოწმე.",
  consumable: "კატალოგში ამ პროდუქტთან დაკავშირებული სახარჯი მასალები. გამოყენებამდე შეადარე დანიშნულება და საჭირო პარამეტრები.",
};
