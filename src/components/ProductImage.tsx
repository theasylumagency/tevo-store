import Image from "next/image";
import type { MediaItem } from "@/lib/catalog";
import { t } from "@/i18n";

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
      <div className={`flex items-center justify-center bg-line/40 text-xs text-ink-2 ${className}`}>
        {t("product.no_photo")}
      </div>
    );
  }
  return (
    <div className={`relative bg-white ${className}`}>
      <Image src={`/media/${item.file}`} alt={alt} fill sizes={sizes} priority={priority}
             className="object-contain p-2" />
    </div>
  );
}
