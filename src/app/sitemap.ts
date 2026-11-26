import type { MetadataRoute } from "next";
import { getIndex, getNavigation } from "@/lib/catalog";
import { LEGAL_SLUGS } from "@/content/legal";
import { getStore } from "@/config/store";
import { absUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (getStore().showReview) return [];   // review/staging builds are not indexed
  const [{ visible, catalog }, nav] = await Promise.all([getIndex(), getNavigation()]);
  const lastModified = new Date(catalog.generated_at);
  return [
    { url: absUrl("/"), lastModified, changeFrequency: "daily", priority: 1 },
    ...nav.flatMap((c) => [
      { url: absUrl(`/catalog/${c.slug}`), lastModified, changeFrequency: "weekly" as const, priority: 0.8 },
      ...c.types.map((ty) => ({ url: absUrl(`/catalog/${c.slug}/${ty.slug}`), lastModified, changeFrequency: "weekly" as const, priority: 0.7 })),
    ]),
    ...visible.map((p) => ({ url: absUrl(`/p/${p.slug}`), lastModified, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...LEGAL_SLUGS.map((s) => ({ url: absUrl(`/info/${s}`), changeFrequency: "yearly" as const, priority: 0.2 })),
  ];
}
