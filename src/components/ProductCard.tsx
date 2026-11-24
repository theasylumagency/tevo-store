import Link from "next/link";
import type { Product } from "@/lib/catalog";
import { mainImage } from "@/lib/catalog";
import { ProductImage } from "./ProductImage";
import { Price } from "./Price";

export function ProductCard({ p, brand, available, review }: {
  p: Product;
  brand: string | null;
  available: Set<string>;
  review?: boolean;
}) {
  const img = mainImage(p);
  return (
    <Link href={`/p/${p.slug}`}
          className="group flex flex-col overflow-hidden rounded-card border border-line bg-surface transition hover:border-ink-2/40 hover:shadow-sm">
      <ProductImage item={img} alt={p.name} available={!!img && available.has(img.file)}
                    sizes="(min-width:1024px) 22vw, (min-width:640px) 45vw, 90vw" className="aspect-square" />
      <div className="flex flex-1 flex-col gap-1 border-t border-line p-3">
        {brand && <span className="text-xs uppercase tracking-wide text-ink-2">{brand}</span>}
        <span className="line-clamp-2 font-medium leading-snug group-hover:text-accent">{p.name}</span>
        {p.subtitle && <span className="line-clamp-1 text-xs text-ink-2">{p.subtitle}</span>}
        <span className="mt-auto pt-2"><Price price={p.price} /></span>
        {review && (
          <span className={`mt-1 self-start rounded px-1.5 py-0.5 text-[11px] ${
            p.data_quality.score >= 80 ? "bg-accent-soft text-accent" : "bg-warn-soft text-warn"}`}>
            {p.data_quality.score}/100 · {p.data_quality.issues.length}
          </span>
        )}
      </div>
    </Link>
  );
}
