/**
 * Known public URLs, for the proxy (no "server-only"/next-cache imports: proxy runs outside React rendering).
 * With streaming, a page can no longer change its HTTP status once the shell is sent, so unknown
 * product/category/legal slugs are answered with a real 404 here, before rendering starts.
 */
import { LEGAL_SLUGS } from "@/content/legal";
import { readPublication } from "./published";
import type { Catalog } from "./types";

const slug = (id: string) => id.toLowerCase().replace(/_/g, "-");

export interface KnownRoutes { products: Set<string>; categories: Set<string>; types: Set<string>; info: Set<string> }

export function buildRoutes(c: Catalog): KnownRoutes {
  const visible = c.products.filter((p) => p.visible);
  const categories = new Set<string>();
  const types = new Set<string>();
  for (const cat of c.categories) {
    for (const ty of cat.product_types) {
      if (visible.some((p) => p.product_type === ty)) {
        categories.add(slug(cat.id));
        types.add(`${slug(cat.id)}/${slug(ty)}`);
      }
    }
    if (visible.some((p) => p.category === cat.id)) categories.add(slug(cat.id));
  }
  return { products: new Set(visible.map((p) => p.slug)), categories, types, info: new Set(LEGAL_SLUGS) };
}

const TTL_MS = 5 * 60_000;
let cached: { at: number; routes: KnownRoutes } | null = null;
let inflight: Promise<KnownRoutes> | null = null;

export async function knownRoutes(): Promise<KnownRoutes> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.routes;
  inflight ??= readPublication()
    .then((c) => { cached = { at: Date.now(), routes: buildRoutes(c) }; return cached.routes; })
    .finally(() => { inflight = null; });
  try {
    return await inflight;
  } catch (e) {
    if (cached) return cached.routes;   // catalog source briefly down: keep serving the last known set
    throw e;
  }
}

/** true = render normally, false = unknown slug (404). Non-catalog paths are always true. */
export function isKnownPath(pathname: string, r: KnownRoutes): boolean {
  const parts = pathname.split("/").filter(Boolean).map((s) => { try { return decodeURIComponent(s); } catch { return s; } });
  if (parts[0] === "p") return parts.length === 2 && r.products.has(parts[1]);
  if (parts[0] === "info") return parts.length === 2 && r.info.has(parts[1]);
  if (parts[0] === "catalog") {
    if (parts.length === 1) return true;
    if (parts.length === 2) return r.categories.has(parts[1]);
    if (parts.length === 3) return r.types.has(`${parts[1]}/${parts[2]}`);
    return false;
  }
  return true;
}
