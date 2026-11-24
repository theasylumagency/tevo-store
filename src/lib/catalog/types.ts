/**
 * Catalog data contract v1 (mirrors data/catalog.schema.json).
 * Today a file produces it; later the Khidi API returns exactly this shape.
 */

export type RelationType = "spare_part" | "accessory" | "consumable" | "fits" | "variant" | "same_size";

export interface Spec {
  key: string;
  label: string;
  value: string;
  num?: number;
  num_max?: number;
  unit?: string;
  source?: string;
}

export interface MediaItem {
  asset_key?: string;
  file: string;
  source_url?: string;
  width?: number;
  height?: number;
  quality?: "ok" | "review";
  quality_flags?: string[];
  role: "main" | "gallery";
  position: number;
  status?: string;
}

export interface Relation {
  type: RelationType;
  product_id: string;
  reason?: string;
}

export interface Compatibility {
  product_types?: string[];
  brands?: string[] | null;
  tire_size?: string;
  engine_model?: string;
  note?: string;
}

export interface Product {
  id: string;
  slug: string;
  legacy_wp_id: number | null;
  name: string;
  subtitle: string | null;
  name_legacy: string | null;
  product_type: string;
  category: string;
  brand: string | null;
  model: string | null;
  variant_group: string | null;
  price: { currency: "GEL"; base: number | null; promo: number | null };
  availability: { status: "in_stock" | "low_stock" | "out_of_stock" | "confirm_with_store"; source?: string };
  visible: boolean;
  attributes: Record<string, string | boolean>;
  specs: Spec[];
  features: string[];
  description: string;
  compatibility: Compatibility | null;
  relations: Relation[];
  media: MediaItem[];
  videos: string[];
  codes: { ean?: string; supplier?: string; legacy_internal?: string };
  data_quality: { score: number; issues: string[] };
}

export interface Category {
  id: string;
  name: string;
  position: number;
  product_types: string[];
}

export interface ProductType {
  id: string;
  name: string;
  name_plural: string;
  category: string;
  facets: string[];
}

export interface Brand {
  id: string;
  name: string;
  name_ka?: string;
  slug?: string;
}

export interface AttributeDef {
  label: string;
  type: "enum" | "bool" | "text";
  values?: string[];
}

export interface SpecDef {
  key: string;
  label: string;
  unit: string | null;
  group: string;
}

export interface Catalog {
  schema_version: string;
  generated_at: string;
  source: { kind: string; [k: string]: unknown };
  categories: Category[];
  product_types: ProductType[];
  brands: Brand[];
  attribute_vocabulary: Record<string, AttributeDef>;
  spec_vocabulary: SpecDef[];
  quality_issue_labels: Record<string, string>;
  products: Product[];
}
