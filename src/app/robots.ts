import type { MetadataRoute } from "next";
import { getStore } from "@/config/store";
import { absUrl, siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  if (getStore().showReview) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/cart", "/checkout", "/order/", "/request", "/pay/", "/o/", "/search"] },
    sitemap: absUrl("/sitemap.xml"),
    host: siteUrl(),
  };
}
