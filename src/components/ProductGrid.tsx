import type { Product } from "@/lib/catalog";
import { getIndex } from "@/lib/catalog";
import { getAvailableMedia } from "@/lib/media";
import { getStore } from "@/config/store";
import { ProductCard } from "./ProductCard";
import css from "./storefront/catalog.module.css";

export async function ProductGrid({ products, cols = 4 }: { products: Product[]; cols?: 3 | 4 }) {
  const [{ brands }, media] = await Promise.all([getIndex(), getAvailableMedia()]);
  const available = new Set(media);
  const review = getStore().showReview;
  return (
    <div className={css.gridFrame}><ul className={css.grid} data-columns={cols}>
      {products.map((p) => (
        <li key={p.id}><ProductCard p={p} brand={p.brand ? brands.get(p.brand) ?? null : null}
                     available={available} review={review} /></li>
      ))}
    </ul></div>
  );
}
