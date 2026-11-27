import type { Catalog, MediaItem, Product, Spec } from "./types";

export const PRODUCT_SPEC_GROUPS = ["engine", "drive", "work", "electric", "general", "other"] as const;
export type ProductSpecGroup = (typeof PRODUCT_SPEC_GROUPS)[number];

/** A missing/new vocabulary group must never hide a real product specification. */
export function groupProductSpecs(product: Pick<Product, "specs">, catalog: Pick<Catalog, "spec_vocabulary">) {
  const vocabulary = new Map(catalog.spec_vocabulary.map((item) => [item.key, item.group]));
  const groups = new Map<ProductSpecGroup, Spec[]>();
  for (const spec of product.specs) {
    if (spec.key === "model" || !spec.value.trim()) continue;
    const rawGroup = vocabulary.get(spec.key);
    const group = PRODUCT_SPEC_GROUPS.includes(rawGroup as ProductSpecGroup) ? rawGroup as ProductSpecGroup : "other";
    groups.set(group, [...(groups.get(group) ?? []), spec]);
  }
  return PRODUCT_SPEC_GROUPS.flatMap((key) => groups.has(key) ? [{ key, specs: groups.get(key)! }] : []);
}

/** Keep product photography uncropped and prefer the declared main photo. */
export function productImages(media: MediaItem[], available: ReadonlySet<string>) {
  const seen = new Set<string>();
  return media
    .filter((image) => available.has(image.file))
    .toSorted((a, b) => Number(b.role === "main") - Number(a.role === "main") || a.position - b.position)
    .filter((image) => {
      if (seen.has(image.file)) return false;
      seen.add(image.file);
      return true;
    })
    .map((image) => ({ src: `/media/${image.file}` }));
}

/** Source values sometimes already contain their unit. Display it only once. */
export function formatSpec(spec: Spec) {
  const value = spec.value.trim();
  const unit = spec.unit?.trim();
  if (!unit || value.endsWith(unit)) return value;
  return `${value} ${unit}`;
}

const POWER_KEYS = ["power_hp", "power_kw", "power_w"];
const PRACTICAL_KEYS: Record<string, string[]> = {
  MOTOBLOCK: ["working_width_cm", "working_depth_cm", "weight_kg"],
  LAWN_MOWER: ["cutting_width", "cutting_height", "weight_kg"],
  SPRAYER: ["capacity_l", "displacement_cc", "weight_kg"],
  MILKING_MACHINE: ["capacity_l", "throughput", "weight_kg"],
  FARM_PROCESSOR: ["throughput", "capacity_l", "weight_kg"],
  FEED_MILL: ["throughput", "weight_kg", "dimensions"],
  WATER_PUMP: ["x_nakadis-sichkare", "x_mitsodebis-simaghle", "x_shetsovis-simaghle"],
  TIRE: ["dimensions", "compatibility", "material"],
  TUBE: ["dimensions", "material"],
  WHEEL_RIM: ["dimensions", "compatibility", "material"],
  JACK: ["max_load_kg", "x_atsevis-simaghle", "x_maksimaluri-simaghle"],
  LADDER: ["x_maksimaluri-simaghle", "x_maksimaluri-gamdzleoba", "material"],
  CONCRETE_MIXER: ["x_barabnis-tevadoba", "weight_kg"],
  WHEELBARROW: ["max_load_kg", "wheel_size"],
  ATV: ["displacement_cc", "max_load_kg", "max_speed_kmh"],
  CONSUMABLE: ["diameter", "dimensions", "x_siske", "purpose"],
  HAND_TOOL: ["length", "dimensions", "material"],
  POWER_TOOL: ["disc_mm", "diameter", "rpm", "weight_kg"],
};

/** A short, truthful comparison aid shared by cards and the product screen. */
export function productHighlights(product: Product, limit = 2): Spec[] {
  const candidates = product.specs.filter((spec) => spec.key !== "model" && spec.key !== "engine_model" && spec.value.trim());
  const byKey = new Map(candidates.map((spec) => [spec.key, spec]));
  const power = POWER_KEYS.map((key) => byKey.get(key)).find(Boolean);
  const practical = PRACTICAL_KEYS[product.product_type] ?? ["throughput", "capacity_l", "cutting_width", "max_load_kg", "dimensions", "weight_kg"];
  const result: Spec[] = [];
  const add = (spec: Spec | undefined) => {
    if (!spec || result.some((item) => item.key === spec.key)) return;
    if (POWER_KEYS.includes(spec.key) && result.some((item) => POWER_KEYS.includes(item.key))) return;
    result.push(spec);
  };
  add(power);
  practical.forEach((key) => add(byKey.get(key)));
  candidates.filter((spec) => /\d/.test(spec.value) && !["country", "manufacture_date", "warranty_months"].includes(spec.key)).forEach(add);
  candidates.forEach(add);
  return result.slice(0, Math.max(0, Math.min(4, Math.trunc(limit))));
}

/** Quantity entry and repeated additions share the actual remaining per-line capacity. */
export function productQuantity(value: string | number, remaining: number) {
  const max = Math.max(0, Math.trunc(remaining));
  if (!max) return 0;
  const numeric = Number(value);
  return Math.min(max, Math.max(1, Number.isFinite(numeric) ? Math.trunc(numeric) : 1));
}
