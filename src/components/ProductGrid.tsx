import type { Product } from "@/lib/catalog";
import { getIndex } from "@/lib/catalog";
import { getAvailableMedia } from "@/lib/media";
import { getStore } from "@/config/store";
import { ProductCard } from "./ProductCard";

export async function ProductGrid({ products, cols = 4 }: { products: Product[]; cols?: 3 | 4 }) {
  const [{ brands }, media] = await Promise.all([getIndex(), getAvailableMedia()]);
  const available = new Set(media);
  const review = getStore().showReview;
  return (
    <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${cols === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
      {products.map((p) => (
        <ProductCard key={p.id} p={p} brand={p.brand ? brands.get(p.brand) ?? null : null}
                     available={available} review={review} />
      ))}
    </div>
  );
}
