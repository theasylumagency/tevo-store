import type { NextRequest } from "next/server";
import { getChoiceProducts } from "@/lib/choices/catalog";
import { cleanChoiceIds } from "@/lib/choices/types";

/** Public, read-only lookup. Private drafts and stored price snapshots are never returned. */
export async function GET(request: NextRequest) {
  const input = request.nextUrl.searchParams.get("ids") ?? "";
  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
  if (input.length > 4096) return Response.json({ error: "invalid_selection" }, { status: 400, headers });
  const ids = cleanChoiceIds(input.split(","));
  try {
    return Response.json(await getChoiceProducts(ids), { headers });
  } catch {
    return Response.json({ error: "catalog_unavailable" }, { status: 503, headers });
  }
}
