import Link from "next/link";
import { brandName, getIndex, type Product, getRelated, toSlug } from "@/lib/catalog";
import { getAvailableMedia } from "@/lib/media";
import { getStoreProfile } from "@/lib/settings";
import { formatPrice } from "@/lib/format";
import { productImages, productHighlights, formatSpec } from "@/lib/catalog/product-presentation";
import { productCompatibility } from "@/lib/catalog/compatibility";
import { Breadcrumbs } from "@/components/Header";
import { Gallery } from "@/components/Gallery";
import { Price } from "@/components/Price";
import { Description, ReviewPanel, SpecTable } from "@/components/ProductDetails";
import { DescriptionVisibility } from "@/components/DescriptionVisibility";
import { ProductGrid } from "@/components/ProductGrid";
import { AddToCart } from "@/components/cart/AddToCart";
import { ProductChoiceActions } from "@/components/choices/ProductChoiceActions";
import { Compatibility, RelatedProductContext } from "@/components/Compatibility";
import { t, type MessageKey } from "@/i18n";
import { productCopy } from "@/i18n/product";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbLd, productLd } from "@/lib/structured-data";
import ui from "./storefront/foundation.module.css";
import styles from "./product.module.css";

export async function ProductView({ product: p, preview = false }: { product: Product; preview?: boolean }) {
  const [{ catalog, types, categories }, media, related, brand, store] = await Promise.all([
    getIndex(), getAvailableMedia(), getRelated(p), brandName(p.brand), getStoreProfile(),
  ]);
  const images = productImages(p.media, new Set(media));
  const type = types.get(p.product_type)!;
  const cat = categories.get(p.category)!;
  const typeHref = `/catalog/${toSlug(cat.id)}/${toSlug(type.id)}`;
  const code = p.codes.supplier ?? p.codes.ean;
  const crumbs = [
    { href: "/", label: t("nav.home") },
    { href: `/catalog/${toSlug(cat.id)}`, label: cat.name },
    { href: typeHref, label: type.name_plural },
    { label: p.name },
  ];
  const unavailable = p.availability.status === "out_of_stock";
  const stockPending = p.availability.status === "confirm_with_store";
  const noPrice = p.price.base === null;
  const purchaseBlocked = unavailable || stockPending || noPrice;
  const highlights = productHighlights(p, 2);
  const compatibility = productCompatibility(p, catalog);
  const Title = preview ? "h2" : "h1";

  return (
    <article className={styles.product} data-storefront-theme={preview ? "" : undefined}>
      {!preview && <JsonLd data={productLd(p, { brand, images: images.map((i) => i.src), storeName: store.name })} />}
      {!preview && <JsonLd data={breadcrumbLd(crumbs)} />}
      {!preview && <Breadcrumbs items={crumbs} />}
      <div className={styles.overview}>
        <header className={styles.heading}>
          <div className={styles.identity}>
            {brand && <p className={ui.eyebrow}>{brand}</p>}
            {p.model && <p>{t("product.model")}: <span>{p.model}</span></p>}
          </div>
          <Title className={ui.pageTitle}>{p.name}</Title>
          {p.subtitle && <p className={ui.lead}>{p.subtitle}</p>}
          {code && <p className={styles.code}>{t("product.code")}: <span>{code}</span></p>}
        </header>

        <div className={styles.media}>
          <Gallery key={p.id} images={images} alt={p.name} emptyLabel={t("product.no_photo")} />
        </div>

        <section className={styles.purchase} aria-label={productCopy.price}>
          <p className={styles.priceLabel}>{productCopy.price}</p>
          <Price price={p.price} size="lg" />
          <p className={styles.availability} data-status={p.availability.status}>
            <span aria-hidden="true" />{t(`product.availability.${p.availability.status}` as MessageKey)}
          </p>
          {preview ? <div className={styles.previewAction}>
            <button className={ui.primaryAction} type="button" disabled>{productCopy.previewAction}</button>
            <p>{productCopy.previewHint}</p>
          </div> : <AddToCart key={p.id} disabled={purchaseBlocked}
            disabledDescriptionId={purchaseBlocked ? `purchase-reason-${p.id}` : undefined}
            maxQuantity={store.maxQuantityPerLine} item={{
              productId: p.id, slug: p.slug, name: p.name, price: p.price.promo ?? p.price.base,
              image: images[0]?.src ?? null,
            }} />}
          {!preview && <ProductChoiceActions productId={p.id} productName={p.name} />}
          {purchaseBlocked && <div className={styles.purchaseRecovery}>
            <p id={`purchase-reason-${p.id}`}>{unavailable ? productCopy.soldOut : stockPending ? productCopy.confirmStock : productCopy.askPrice}</p>
            <div className={ui.actions}>
              <Link href={preview ? "/info/contact" : "/request?product=" + encodeURIComponent(p.id)} className={ui.secondaryAction}>{preview ? productCopy.contact : stockPending ? productCopy.stockContact : "სრული პირობების დაზუსტება"}</Link>
              {(unavailable || stockPending) && <Link href={typeHref} className={ui.quietAction}>{productCopy.browseType}</Link>}
            </div>
          </div>}

          {!preview && !purchaseBlocked && <Link href={"/request?product=" + encodeURIComponent(p.id)} className={ui.secondaryAction}>სრული პირობების დაზუსტება</Link>}
          {(store.deliveryMethods.length > 0) && <div className={styles.fulfillment}>
            <h2>{productCopy.deliveryTitle}</h2>
            <ul>
              {store.deliveryMethods.includes("delivery") && <li>{store.deliveryFee === null
                ? productCopy.deliveryUnknown
                : store.deliveryFee === 0 ? productCopy.deliveryFree
                : `${productCopy.deliveryFixed}: ${formatPrice(store.deliveryFee / 100)}.`}</li>}
              {store.deliveryMethods.includes("pickup") && <li>{productCopy.pickup}
                {store.contact.pickupAddress && <span className={styles.pickupAddress}>{store.contact.pickupAddress}</span>}
              </li>}
            </ul>
            <Link href="/info/delivery" className={ui.quietAction}>{productCopy.deliveryDetails}</Link>
          </div>}
        </section>

        {(highlights.length > 0 || p.features.length > 0 || compatibility.show || store.showReview) && <div className={styles.summary}>
          {(highlights.length > 0 || p.features.length > 0) && <section>
            <h2 className={styles.summaryTitle}>{productCopy.keyFacts}</h2>
            {highlights.length > 0 && <dl className={styles.highlights}>
              {highlights.map((spec) => <div key={spec.key}><dt>{spec.label}</dt><dd>{formatSpec(spec)}</dd></div>)}
            </dl>}
            {p.features.length > 0 && <ul className={styles.features}>
              {p.features.map((feature, index) => <li key={`${index}-${feature}`}><span aria-hidden="true">✓</span><span>{feature}</span></li>)}
            </ul>}
          </section>}
          <Compatibility data={compatibility} productId={p.id} />
          {store.showReview && <ReviewPanel product={p} catalog={catalog} />}
        </div>}
      </div>

      <div className={styles.details} data-description={Boolean(p.description.trim())}>
        <section>
          <h2 className={ui.sectionTitle}>{t("product.specs")}</h2>
          <SpecTable product={p} catalog={catalog} />
        </section>
        {p.description.trim() && <section>
          <h2 className={ui.sectionTitle}>{t("product.description")}</h2>
          {preview ? <Description text={p.description} /> :
            <DescriptionVisibility key={p.id}><Description text={p.description} /></DescriptionVisibility>}
        </section>}
      </div>

      {p.videos.length > 0 && <section className={styles.related}>
        <h2 className={ui.sectionTitle}>{t("product.videos")}</h2>
        <ul className={styles.videos}>{p.videos.map((video, index) => <li key={video}>
          <a href={video} className={ui.secondaryAction} target="_blank" rel="noopener noreferrer">
            {productCopy.videoView}{p.videos.length > 1 ? ` ${index + 1}` : ""}
            <span className="sr-only"> — {productCopy.newWindow}</span>
          </a>
        </li>)}</ul>
      </section>}

      {related.map((group) => <section key={group.type} id={`related-${group.type}`} className={styles.related}>
        <h2 className={ui.sectionTitle}>{group.type === "fits" ? "კატალოგში მითითებული მოდელები" : t(`rel.${group.type}` as MessageKey)}</h2>
        <RelatedProductContext product={p} type={group.type} products={group.products} />
        <ProductGrid products={group.products} />
      </section>)}
    </article>
  );
}
