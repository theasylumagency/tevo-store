import Link from "next/link";
import type { Product } from "@/lib/catalog";
import { mainImage } from "@/lib/catalog";
import { ProductImage } from "./ProductImage";
import { Price } from "./Price";
import { t } from "@/i18n";

export function ProductCard({ p, brand, available, review, showDetails = false }: {
  p: Product;
  brand: string | null;
  available: Set<string>;
  review?: boolean;
  showDetails?: boolean;
}) {
  const img = mainImage(p);
  const power = ["power_hp", "power_kw", "power_w"].map(key => p.specs.find(s => s.key === key)).find(Boolean);
  const practicalKeys = p.product_type === "MOTOBLOCK" ? ["working_width_cm", "working_depth_cm", "weight_kg"] :
    ["throughput", "capacity_l", "cutting_width", "max_load_kg", "diameter", "weight_kg"];
  const practical = practicalKeys.map(key => p.specs.find(s => s.key === key)).find(Boolean);
  const details = showDetails ? [power, practical].filter(s => !!s?.value) : [];
  return (
    <Link href={`/p/${p.slug}`}
          className="group flex flex-col overflow-hidden rounded-card border border-line bg-surface transition hover:border-ink-2/40 hover:shadow-sm">
      <ProductImage item={img} alt={p.name} available={!!img && available.has(img.file)}
                    sizes="(min-width:1024px) 22vw, (min-width:640px) 45vw, 90vw" className="aspect-square" />
      <div className="flex flex-1 flex-col gap-1 border-t border-line p-3">
        {brand && <span className="text-xs uppercase tracking-wide text-ink-2">{brand}</span>}
        <span className="line-clamp-2 font-medium leading-snug group-hover:text-accent">{p.name}</span>
        {p.subtitle && <span className="line-clamp-1 text-xs text-ink-2">{p.subtitle}</span>}
        {details.length > 0 && <dl className="mt-2 space-y-1 text-xs text-ink-2">{details.map(s => s && <div key={s.key} className="flex flex-wrap gap-x-1">
          <dt>{s.label}:</dt><dd>{s.value}{s.unit && !s.value.includes(s.unit) ? " " + s.unit : ""}</dd>
        </div>)}</dl>}
        <span className="mt-auto pt-2"><Price price={p.price} /></span>
        {showDetails && <span className="mt-1 text-xs leading-5 text-ink-2">{t(`product.availability.${p.availability.status}`)}</span>}
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
