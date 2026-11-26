import { revalidateTag } from "next/cache";
import { hasBearer } from "@/lib/auth/bearer";

const TAGS = ["catalog", "media"] as const;

/**
 * Refresh cached catalog data and the list of available photos without a rebuild —
 * after replacing data/catalog.json, syncing new photos, or on first start of a fresh deploy.
 *   curl -fsS -X POST -H "Authorization: Bearer $CRON_TOKEN" "https://rodo.ge/api/revalidate?tag=media"
 * Without ?tag both are refreshed.
 */
export async function POST(req: Request) {
  if (!hasBearer(req, "CRON_TOKEN")) return Response.json({ error: "unauthorized" }, { status: 401 });
  const tag = new URL(req.url).searchParams.get("tag");
  const tags = tag ? TAGS.filter((x) => x === tag) : [...TAGS];
  if (!tags.length) return Response.json({ error: "unknown tag" }, { status: 400 });
  for (const x of tags) revalidateTag(x, { expire: 0 });
  return Response.json({ revalidated: tags });
}
