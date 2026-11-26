import type { Product } from "@/lib/catalog/types";
import { absUrl } from "@/lib/site";

const AVAILABILITY: Partial<Record<Product["availability"]["status"], string>> = {
  in_stock: "https://schema.org/InStock",
  low_stock: "https://schema.org/LimitedAvailability",
  out_of_stock: "https://schema.org/OutOfStock",
  // confirm_with_store: no claim — availability is unknown until the store confirms
};

const plain = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/[#*_>`]/g, "").replace(/\s+/g, " ").trim();

export function productLd(p: Product, opts: { brand: string | null; images: string[]; storeName: string }) {
  const price = p.price.promo ?? p.price.base;
  const desc = plain(p.description || p.subtitle || p.name).slice(0, 500);
  const ean = p.codes.ean && /^\d{8}$|^\d{12,14}$/.test(p.codes.ean) ? p.codes.ean : undefined;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: desc,
    url: absUrl(`/p/${p.slug}`),
    ...(opts.images.length ? { image: opts.images.map(absUrl) } : {}),
    ...(p.codes.supplier ? { sku: p.codes.supplier } : {}),
    ...(ean ? { gtin: ean } : {}),
    ...(p.model ? { model: p.model } : {}),
    ...(opts.brand ? { brand: { "@type": "Brand", name: opts.brand } } : {}),
    ...(price !== null ? {
      offers: {
        "@type": "Offer",
        url: absUrl(`/p/${p.slug}`),
        price: price.toFixed(2),
        priceCurrency: p.price.currency,
        itemCondition: "https://schema.org/NewCondition",
        ...(AVAILABILITY[p.availability.status] ? { availability: AVAILABILITY[p.availability.status] } : {}),
        seller: { "@type": "Organization", name: opts.storeName },
      },
    } : {}),
  };
}

export function breadcrumbLd(items: { href?: string; label: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem", position: i + 1, name: it.label, ...(it.href ? { item: absUrl(it.href) } : {}),
    })),
  };
}
