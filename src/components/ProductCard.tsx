import Link from "next/link";
import type { Product } from "@/lib/catalog";
import { mainImage } from "@/lib/catalog";
import { ProductImage } from "./ProductImage";
import { Price } from "./Price";
import { ProductChoiceActions } from "./choices/ProductChoiceActions";
import { t } from "@/i18n";
import { formatSpec, productHighlights } from "@/lib/catalog/product-presentation";
import css from "./storefront/catalog.module.css";

export function ProductCard({ p, brand, available, review }: {
  p: Product;
  brand: string | null;
  available: Set<string>;
  review?: boolean;
  showDetails?: boolean;
}) {
  const img = mainImage(p);
  const details = productHighlights(p);
  return (
    <article className={css.card} data-product-card={p.id}>
      <Link href={`/p/${p.slug}`} className={css.cardLink}>
      <ProductImage item={img} alt={p.name} available={!!img && available.has(img.file)}
                    sizes="(min-width:1280px) 290px, (min-width:1024px) 25vw, (min-width:720px) 32vw, (min-width:384px) 46vw, 92vw" className={css.photo} />
      <div className={css.cardBody}>
        <span className={css.identity}>
          {brand && <span className={css.brand}>{brand}</span>}
          {p.model && <span className={css.model}><span className="sr-only">მოდელი: </span>{p.model}</span>}
        </span>
        <span className={css.name}>{p.name}</span>
        {p.subtitle && <span className={css.subtitle}>{p.subtitle}</span>}
        {details.length > 0 && <dl className={css.specs}>{details.map(s => <div key={s.key}>
          <dt>{s.label}:</dt><dd>{formatSpec(s)}</dd>
        </div>)}</dl>}
        <div className={css.cardFoot}><Price price={p.price} />
          <span className={css.availability} data-status={p.availability.status}>{t(`product.availability.${p.availability.status}`)}</span>
        </div>
        {review && (
          <span className={css.review}>
            {p.data_quality.score}/100 · {p.data_quality.issues.length}
          </span>
        )}
      </div>
      </Link>
      <ProductChoiceActions productId={p.id} productName={p.name} compact />
    </article>
  );
}
