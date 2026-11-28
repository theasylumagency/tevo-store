import "server-only";
import { getCatalog, indexCatalog, mainImage, type Catalog } from "@/lib/catalog";
import { getStore } from "@/config/store";
import { readPublication } from "@/lib/catalog/published";
import { toTetri } from "@/lib/money";

export interface CartInputLine { productId: string; qty: number }

export interface QuoteLine {
  productId: string;
  slug: string;
  name: string;
  model: string | null;
  brand: string | null;
  image: string | null;
  unitPrice: number;   // tetri
  qty: number;
  lineTotal: number;   // tetri
}

export interface QuoteProblem { productId: string; kind: "unavailable" | "no_price" | "qty_clamped" | "stock_unconfirmed" }

export interface Quote {
  lines: QuoteLine[];
  problems: QuoteProblem[];
  subtotal: number;
  deliveryFee: number | null;
  total: number;
  catalogVersion: string;
}

/** The only place prices for an order are decided: always from the catalog, never from the browser. */
export async function quoteCart(input: CartInputLine[], fresh = false): Promise<Quote> {
  return quotePublication(input, fresh ? await readPublication() : await getCatalog());
}

export function quotePublication(input: CartInputLine[], catalog: Catalog): Quote {
  const { byId, brands } = indexCatalog(catalog);
  const store = getStore();
  const merged = new Map<string, number>();
  for (const l of input.slice(0, 100)) {
    if (typeof l?.productId !== "string") continue;
    const q = Math.floor(Number(l.qty));
    if (!Number.isFinite(q) || q <= 0) continue;
    merged.set(l.productId, (merged.get(l.productId) ?? 0) + q);
  }
  const lines: QuoteLine[] = [];
  const problems: QuoteProblem[] = [];
  for (const [productId, wanted] of merged) {
    const p = byId.get(productId);
    if (!p || !p.visible || p.availability.status === "out_of_stock") { problems.push({ productId, kind: "unavailable" }); continue; }
    // Keep the selection visible, but never authorize an order for uncertain stock.
    if (p.availability.status === "confirm_with_store") problems.push({ productId, kind: "stock_unconfirmed" });
    const price = p.price.promo ?? p.price.base;
    if (price === null || price <= 0) { problems.push({ productId, kind: "no_price" }); continue; }
    const qty = Math.min(wanted, store.maxQuantityPerLine);
    if (qty !== wanted) problems.push({ productId, kind: "qty_clamped" });
    const unitPrice = toTetri(price);
    const img = mainImage(p);
    lines.push({
      productId, slug: p.slug, name: p.name, model: p.model, brand: p.brand ? brands.get(p.brand) ?? null : null,
      image: img ? `/media/${img.file}` : null, unitPrice, qty, lineTotal: unitPrice * qty,
    });
  }
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const deliveryFee = store.deliveryFee;
  return { lines, problems, subtotal, deliveryFee, total: subtotal + (deliveryFee ?? 0),
           catalogVersion: catalog.generated_at };
}
