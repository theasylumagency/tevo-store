import Image from "next/image";
import type { MediaItem } from "@/lib/catalog";
import { t } from "@/i18n";
import css from "./storefront/media.module.css";

export function ProductImage({ item, alt, available, sizes, priority, className = "" }: {
  item?: MediaItem;
  alt: string;
  available: boolean;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  if (!item || !available) {
    return (
      <div className={`${css.missing} ${className}`} role="img" aria-label={`${alt} — ${t("product.no_photo")}`}>
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 3-3 6 6"/></svg>
        <span aria-hidden="true">{t("product.no_photo")}</span>
      </div>
    );
  }
  return (
    <div className={`${css.frame} ${className}`}>
      <Image src={`/media/${item.file}`} alt={alt} fill sizes={sizes}
             loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : undefined} className={css.image} />
    </div>
  );
}
