import Link from "next/link";
import type { Product, RelationType } from "@/lib/catalog/types";
import { relatedProductReasons, relationDescriptions, type CompatibilityPresentation } from "@/lib/catalog/compatibility";
import ui from "./storefront/foundation.module.css";
import css from "./compatibility.module.css";

/** Server-rendered facts stay separate from a promise that every model will fit. */
export function Compatibility({ data, productId }: { data: CompatibilityPresentation; productId: string }) {
  if (!data.show) return null;
  const titleId = `compatibility-${productId}`;
  return <section className={css.panel} aria-labelledby={titleId} data-product-compatibility>
    <h2 id={titleId} className={css.title}>თავსებადობა</h2>
    {data.hasEvidence ? <>
      {data.fields.length > 0 && <dl className={css.facts}>
        {data.fields.map((field) => <div key={field.key}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}
      </dl>}
      {data.note && <div className={css.note}><h3>კატალოგის შენიშვნა</h3><p>{data.note}</p></div>}
      {data.fits.length > 0 && <div className={css.models}>
        <h3>კატალოგში მითითებული მოდელები</h3>
        <ul>{data.fits.map((item) => <li key={item.id}>
          <Link href={item.href}>{item.name}</Link>
          {item.reason && <p>{item.reason}</p>}
        </li>)}</ul>
        {data.fitCount > data.fits.length && <a href="#related-fits" className={ui.quietAction}>სხვა მითითებული მოდელები</a>}
      </div>}
      <p className={css.guidance}>შეძენამდე შეადარე შენი მოწყობილობის ზუსტი მოდელი, ზომა და შეერთება. მხოლოდ ტიპის ან ბრენდის დამთხვევა ყველა მოდელთან თავსებადობას არ ადასტურებს.</p>
    </> : <p className={css.guidance}>ზუსტ მოდელებთან თავსებადობა კატალოგში ჯერ მითითებული არ არის. მოგვწერე მოწყობილობის მოდელი, ნაწილის კოდი ან ზომა და არჩევანში დაგეხმარებით.</p>}
    <Link href="/info/contact" className={ui.quietAction}>თავსებადობის დაზუსტება</Link>
  </section>;
}

export function RelatedProductContext({ product, type, products }: {
  product: Product;
  type: RelationType;
  products: Product[];
}) {
  const reasons = relatedProductReasons(product, type, products).filter((item) => item.reason);
  return <div className={css.relatedContext}>
    <p>{relationDescriptions[type]}</p>
    {reasons.length > 0 && <details className={css.reasons}>
      <summary>რატომ არის ეს პროდუქტები დაკავშირებული</summary>
      <ul>{reasons.map((item) => <li key={item.id}>
        <Link href={item.href}>{item.name}</Link>
        <p>{item.reason}</p>
      </li>)}</ul>
    </details>}
  </div>;
}
