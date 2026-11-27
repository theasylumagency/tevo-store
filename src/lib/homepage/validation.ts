import { z } from "zod";
import { blocks, collectionSortNames, initialHome, localTime, presets, serviceNames, type HomeDocument } from "./model";

export class HomeInputError extends Error {}
// Drafts may contain unfinished copy. Required active content is checked at publication.
const title = z.string().trim().max(100);
const text = z.string().trim().max(350);
const photo = z.string().max(255).refine(v => !v ||
  /^originals\/[^/\\?#\x00-\x1f]+\.(?:avif|webp|jpe?g|png)$/i.test(v) ||
  /^homepage\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.webp$/.test(v));
const type = z.string().max(90).regex(/^[A-Z0-9_]*$/);
const sku = z.string().regex(/^at-\d+$/);
const date = z.string().refine(v => !v || Number.isFinite(localTime(v)));
const layout = z.array(z.enum(blocks)).min(1).max(blocks.length).refine(v => new Set(v).size === v.length && v.includes("catalog"));
const defaults = initialHome();
const target = z.object({
  kind: z.enum(["none", "catalog", "category", "type", "product"]),
  value: z.string().max(90), label: z.string().trim().max(80),
}).refine(v => v.value === "" ||
  (v.kind === "product" ? /^at-\d+$/.test(v.value) :
    v.kind === "type" || v.kind === "category" ? /^[A-Z0-9_]+$/.test(v.value) : false));
const media = {
  photo, mobilePhoto: photo.default(""),
  focalX: z.number().min(0).max(100).default(50), focalY: z.number().min(0).max(100).default(50),
};
const collection = z.object({
  title, text, mode: z.enum(["type", "manual"]), type,
  ids: z.array(sku).max(8).refine(a => new Set(a).size === a.length),
  limit: z.union([z.literal(4), z.literal(8)]).default(8),
  sort: z.enum(Object.keys(collectionSortNames) as [keyof typeof collectionSortNames, ...(keyof typeof collectionSortNames)[]]).default("recommended"),
  onlyInStock: z.boolean().default(false),
});
const schema = z.object({
  preset: z.enum(presets), layouts: z.object({ catalog: layout, offer: layout, guide: layout }),
  intro: z.object({ title, text, ...media, target: target.default(defaults.intro.target) }), catalogTitle: title,
  categoryIds: z.array(type.min(1)).max(24).refine(a => new Set(a).size === a.length).default([]),
  offer: z.object({ title, text, ...media, product: z.union([sku, z.literal("")]), start: date, end: date, fallback: z.enum(["hide", "picks"]) }),
  guide: z.object({ title, tasks: z.array(z.object({ title, text, type })).max(6) }),
  picks: collection,
  seasonal: collection.default(defaults.seasonal),
  advice: z.object({ title, text, target }).default(defaults.advice),
  service: z.object({ title, items: z.array(z.enum(Object.keys(serviceNames) as [keyof typeof serviceNames, ...(keyof typeof serviceNames)[]]))
    .max(4).refine(a => new Set(a).size === a.length) }).default(defaults.service),
  popularTitle: title,
});
export function parseHome(input: unknown): HomeDocument {
  const result = schema.safeParse(input);
  if (!result.success) throw new HomeInputError("შეამოწმე ტექსტების სიგრძე, თარიღები, ფოტოები და არჩეული ბლოკები.");
  const doc = result.data;
  if (presets.some(p => doc.layouts[p][0] !== p)) throw new HomeInputError("პირველი ბლოკი არჩეულ განლაგებას უნდა შეესაბამებოდეს.");
  if (doc.offer.start && doc.offer.end && localTime(doc.offer.end) <= localTime(doc.offer.start)) {
    throw new HomeInputError("შეთავაზების დასრულება დაწყების შემდეგ უნდა იყოს.");
  }
  return doc;
}
