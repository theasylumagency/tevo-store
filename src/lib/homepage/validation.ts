import { z } from "zod";
import { blocks, localTime, presets, type HomeDocument } from "./model";

export class HomeInputError extends Error {}
const title = z.string().trim().min(1).max(100);
const text = z.string().trim().max(350);
const photo = z.string().max(255).refine(v => !v || /^originals\/[^/\\?#\x00-\x1f]+\.(?:avif|webp|jpe?g|png)$/i.test(v));
const type = z.string().max(90).regex(/^[A-Z0-9_]*$/);
const sku = z.string().regex(/^at-\d+$/);
const date = z.string().refine(v => !v || Number.isFinite(localTime(v)));
const layout = z.array(z.enum(blocks)).min(1).max(blocks.length).refine(v => new Set(v).size === v.length && v.includes("catalog"));
const schema = z.object({
  preset: z.enum(presets), layouts: z.object({ catalog: layout, offer: layout, guide: layout }),
  intro: z.object({ title, text, photo }), catalogTitle: title,
  offer: z.object({ title, text, photo, product: z.union([sku, z.literal("")]), start: date, end: date, fallback: z.enum(["hide", "picks"]) }),
  guide: z.object({ title, tasks: z.array(z.object({ title, text, type: type.min(1) })).max(6) }),
  picks: z.object({ title, text, mode: z.enum(["type", "manual"]), type, ids: z.array(sku).max(8).refine(a => new Set(a).size === a.length) }),
  popularTitle: title,
});
export function parseHome(input: unknown): HomeDocument {
  const result = schema.safeParse(input);
  if (!result.success) throw new HomeInputError("შეამოწმე სათაურები, თარიღები და არჩეული ბლოკები.");
  const doc = result.data;
  if (presets.some(p => doc.layouts[p][0] !== p)) throw new HomeInputError("პირველი ბლოკი არჩეულ განლაგებას უნდა შეესაბამებოდეს.");
  if (doc.offer.start && doc.offer.end && localTime(doc.offer.end) <= localTime(doc.offer.start)) {
    throw new HomeInputError("შეთავაზების დასრულება დაწყების შემდეგ უნდა იყოს.");
  }
  return doc;
}
