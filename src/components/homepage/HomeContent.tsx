import Link from "next/link";
import Image, { getImageProps } from "next/image";
import { cacheLife, cacheTag } from "next/cache";
import { getIndex, getNavigation, mainImage, toSlug, type Product } from "@/lib/catalog";
import { getAvailableMedia } from "@/lib/media";
import { getStore } from "@/config/store";
import { getStoreProfile } from "@/lib/settings";
import { getTopSellers } from "@/lib/homepage/cache";
import { featuredCategories, homeEligible, homeSelection, resolveHomeTarget } from "@/lib/homepage/selection";
import { blockNames, initialHome, normalizeHome, type HomeDocument, type HomePhoto, type ServiceItem } from "@/lib/homepage/model";
import { ProductCard } from "@/components/ProductCard";
import { Price } from "@/components/Price";
import { CategoryIcon, ChevronIcon } from "@/components/StoreIcons";
import { formatPrice } from "@/lib/format";
import { t } from "@/i18n";
import foundation from "@/components/storefront/foundation.module.css";
import grid from "@/components/storefront/catalog.module.css";
import css from "./home.module.css";

type Screen = "desktop" | "mobile";
function Photo({ file, options, available, priority, previewScreen, compact = false }: {
  file: string; options: HomePhoto; available: Set<string>; priority: boolean; previewScreen?: Screen; compact?: boolean;
}) {
  const mobile = available.has(options.mobilePhoto) ? options.mobilePhoto : file;
  const style = { objectPosition: `${options.focalX}% ${options.focalY}%` };
  const sizes = compact ? "192px" : "(max-width: 650px) 90vw, (max-width: 1200px) 43vw, 520px";
  if (previewScreen || mobile === file) return <div className={css.photo}>
    <Image src={"/media/" + (previewScreen === "mobile" ? mobile : file)} alt="" fill preload={priority}
      sizes={sizes} className="object-contain" style={style}/>
  </div>;
  const desktopProps = getImageProps({ src: "/media/" + file, alt: "", width: 1200, height: 750, sizes }).props;
  const mobileProps = getImageProps({ src: "/media/" + mobile, alt: "", width: 800, height: 500, sizes }).props;
  return <div className={css.photo}><picture>
    <source media="(max-width: 650px)" srcSet={mobileProps.srcSet} sizes={sizes}/>
    {/* getImageProps provides the same optimized assets with browser-native art direction. */}
    <img {...desktopProps} alt="" loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"}
      className="absolute inset-0 h-full w-full object-contain" style={style}/>
  </picture></div>;
}

export async function HomeContent({ doc: input, offerOpen, previewScreen }: {
  doc: HomeDocument; offerOpen: boolean; previewScreen?: Screen;
}) {
  "use cache";
  const doc = normalizeHome(input);
  const active = doc.layouts[doc.preset];
  if (active.includes("popular")) { cacheLife("minutes"); cacheTag("home-sales"); }
  else cacheLife("hours");
  cacheTag("catalog", "media", "homepage", "settings");
  const [index, nav, media, sales, store] = await Promise.all([getIndex(), getNavigation(), getAvailableMedia(),
    active.includes("popular") ? getTopSellers() : [], active.includes("service") ? getStoreProfile() : Promise.resolve(getStore())]);
  const { offer, picks, seasonal, popular, sections } = homeSelection(doc, index.visible, sales, offerOpen);
  const available = new Set(media);
  const review = getStore().showReview;
  const introPhoto = available.has(doc.intro.photo) ? doc.intro.photo :
    available.has(doc.intro.mobilePhoto) ? doc.intro.mobilePhoto : "";
  const chosenCategories = featuredCategories(doc.categoryIds, nav);
  const categories = chosenCategories.length ? chosenCategories : nav;
  const introTarget = resolveHomeTarget(doc.intro.target, index.catalog);
  const hasIntroAction = !!introTarget && !!doc.intro.target.label.trim();
  function productCards(products: Product[]) {
    return <div className={grid.gridFrame}><ul className={grid.grid} data-columns={4}>
      {products.map(p => <li key={p.id}><ProductCard p={p} available={available}
        brand={p.brand ? index.brands.get(p.brand) ?? p.brand : null} review={review}/></li>)}
    </ul></div>;
  }
  const services: Record<ServiceItem, { title: string; text: string; href: string } | null> = {
    delivery: store.deliveryMethods.length ? { title: "მიწოდება და მიღება",
      text: store.deliveryMethods.includes("delivery") ? (store.deliveryFee === null ? "მიწოდების ღირებულება და ვადა შეკვეთისთვის დაზუსტდება." :
        `მიწოდების ღირებულება ${formatPrice(store.deliveryFee / 100)}.`) : "გაეცანი თვითგატანის პირობებს.", href: "/info/delivery" } : null,
    warranty: { title: "საგარანტიო პირობები", text: "შეამოწმე პროდუქტის გარანტიისა და სერვისის პირობები.", href: "/info/warranty" },
    payment: { title: "გადახდის პირობები", text: "ხელმისაწვდომი გადახდის გზები ჩანს შეკვეთის გაფორმებისას.", href: "/info/delivery" },
    contact: store.contact.phone || store.contact.email ? { title: "დახმარება არჩევაში",
      text: [store.contact.phone, store.contact.email].filter(Boolean).join(" · "), href: "/info/contact" } : null,
  };
  const primaryOffer = doc.preset === "offer" && !!offer;
  const primaryGuide = doc.preset === "guide" && sections.some(section => section.key === "guide");
  const catalogLink = <Link href="/search" className={foundation.quietAction}>სრული კატალოგი<ChevronIcon size={18}/></Link>;
  return <div className={css.home} data-home-preset={doc.preset}><div className={css.stack}>
    {!primaryOffer && <header className={css.hero} data-photo={!!introPhoto} data-compact={primaryGuide}>
      <div className={css.heroCopy}>
        <h1 className={foundation.pageTitle}>{doc.intro.title.trim() || initialHome().intro.title}</h1>
        {doc.intro.text && <p className={foundation.lead}>{doc.intro.text}</p>}
        <div className={foundation.actions}>
          {hasIntroAction && <Link className={primaryGuide ? foundation.secondaryAction : foundation.primaryAction}
            href={introTarget!}>{doc.intro.target.label}<ChevronIcon size={18}/></Link>}
          {!hasIntroAction && !primaryGuide
            ? <Link href="/search" className={foundation.primaryAction}>სრული კატალოგი<ChevronIcon size={18}/></Link>
            : (introTarget !== "/search" || !hasIntroAction) && catalogLink}
        </div>
      </div>
      {introPhoto && <Photo file={introPhoto} options={doc.intro} available={available} priority={!primaryGuide} compact={primaryGuide} previewScreen={previewScreen}/>}
    </header>}
    {sections.map(({ key, fallback }) => {
      if (key === "catalog") return <section key={key} id="catalog" aria-labelledby="home-catalog-title" data-home-block={key} className={css.section}>
        <div className={css.sectionHead}><h2 id="home-catalog-title" className={foundation.sectionTitle}>{doc.catalogTitle.trim() || initialHome().catalogTitle}</h2>
          {doc.categoryIds.length > 0 && <Link href="/search" className={foundation.quietAction}>ყველა კატეგორია<ChevronIcon size={18}/></Link>}
        </div>
        {categories.length ? <div className={css.categories}>{categories.map(c => <Link key={c.id} href={"/catalog/" + c.slug} className={css.category}>
          <span className={css.categoryIcon}><CategoryIcon category={c.id} size={26}/></span>
          <h3>{c.name}</h3>
          <p className={css.categoryTypes}>{c.types.slice(0, 3).map(type => type.name).join(" · ")}</p>
          <span className={css.cardFoot}><span>{c.count} პროდუქტი</span><ChevronIcon size={18}/></span>
        </Link>)}</div> : <div className={foundation.state}>
          <h3 className={foundation.stateTitle}>პროდუქტები ჯერ არ ჩანს</h3>
          <p className={foundation.stateCopy}>გთხოვ, მოგვიანებით სცადო ან დაგვიკავშირდე პროდუქტის შესარჩევად.</p>
          <Link href="/info/contact" className={foundation.secondaryAction}>დაგვიკავშირდი</Link>
        </div>}
      </section>;
      if (key === "offer" && offer) {
        const candidate = available.has(doc.offer.photo) ? doc.offer.photo : mainImage(offer)?.file;
        const photo = candidate && available.has(candidate) ? candidate : available.has(doc.offer.mobilePhoto) ? doc.offer.mobilePhoto : "";
        const Heading = primaryOffer ? "h1" : "h2";
        return <section key={key} aria-labelledby="home-offer-title" className={css.offer} data-home-block={key} data-photo={!!photo}>
          <div className={css.heroCopy}><p className={foundation.eyebrow}>{doc.offer.title.trim() || blockNames.offer}</p>
            <Heading id="home-offer-title" className={primaryOffer ? foundation.pageTitle : foundation.sectionTitle}>{offer.name}</Heading>
            {doc.offer.text && <p className={foundation.lead}>{doc.offer.text}</p>}
            <div className={css.offerPrice}><Price price={offer.price} size="lg"/></div>
            <p className={css.availability}>{t(`product.availability.${offer.availability.status}`)}</p>
            <div className={foundation.actions}>
              <Link className={primaryOffer ? foundation.primaryAction : foundation.secondaryAction} href={"/p/" + offer.slug}>პროდუქტის ნახვა<ChevronIcon size={18}/></Link>
              {primaryOffer && catalogLink}
            </div>
          </div>
          {photo && <Photo file={photo} options={doc.offer} available={available} priority={primaryOffer} previewScreen={previewScreen}/>}
        </section>;
      }
      if (key === "guide") {
        const tasks = doc.guide.tasks.flatMap((task, i) => {
          const p = index.visible.find(p => homeEligible(p) && p.product_type === task.type);
          return p && task.title.trim() ? [<Link key={i} href={"/catalog/" + toSlug(p.category) + "/" + toSlug(task.type)} className={css.task}>
            <h3>{task.title}</h3>
            {task.text && <p>{task.text}</p>}
            <span className={css.cardFoot}><span>პროდუქტების ნახვა</span><ChevronIcon size={18}/></span>
          </Link>] : [];
        });
        return tasks.length > 0 && <section key={key} aria-labelledby="home-guide-title" data-home-block={key} className={css.section}>
          <div className={css.sectionHead}><h2 id="home-guide-title" className={foundation.sectionTitle}>{doc.guide.title.trim() || blockNames.guide}</h2></div>
          <div className={css.tasks}>{tasks}</div>
        </section>;
      }
      if (key === "picks" || key === "seasonal" || key === "popular") {
        const collection = key === "popular" ? null : doc[key];
        const products = key === "picks" ? picks : key === "seasonal" ? seasonal : popular;
        return <section key={key} aria-labelledby={`home-${key}-title`} data-home-block={key} className={css.section}><div className={css.sectionHead}>
          <h2 id={`home-${key}-title`} className={foundation.sectionTitle}>{fallback ? blockNames.picks : collection ? collection.title.trim() || blockNames[key] : doc.popularTitle.trim() || blockNames.popular}</h2>
          {collection?.mode === "type" && products.length > 0 && <Link className={foundation.quietAction} href={"/catalog/" + toSlug(products[0].category) + "/" + toSlug(products[0].product_type) +
            (collection.sort === "price_asc" || collection.sort === "price_desc" ? "?sort=" + collection.sort : "")}>
            {collection.onlyInStock || collection.sort === "offers" ? "ამ ტიპის პროდუქტები" : "ყველას ნახვა"}
            <ChevronIcon size={18}/>
          </Link>}
        </div>
          {collection?.text && <p className={css.sectionCopy}>{collection.text}</p>}
          {key === "popular" && <p className={css.sectionCopy}>ბოლო 30 დღის დადასტურებული, გადახდილი შეკვეთების მიხედვით.</p>}
          {productCards(products)}</section>;
      }
      if (key === "advice") {
        const href = resolveHomeTarget(doc.advice.target, index.catalog);
        return href && <section key={key} aria-labelledby="home-advice-title" data-home-block={key} className={css.advice}><div>
          <p className={foundation.eyebrow}>რჩევა არჩევისთვის</p><h2 id="home-advice-title" className={foundation.sectionTitle}>{doc.advice.title}</h2>
          <p className={css.adviceCopy}>{doc.advice.text}</p>
          <Link className={foundation.secondaryAction} href={href}>{doc.advice.target.label.trim() || "პროდუქტების ნახვა"}<ChevronIcon size={18}/></Link>
        </div></section>;
      }
      if (key === "service") {
        const selected = doc.service.items.flatMap(id => services[id] ? [{ id, ...services[id]! }] : []);
        return selected.length > 0 && <section key={key} aria-labelledby="home-service-title" data-home-block={key} className={css.section}>
          <div className={css.sectionHead}><h2 id="home-service-title" className={foundation.sectionTitle}>{doc.service.title.trim() || initialHome().service.title}</h2></div>
          <div className={css.services}>{selected.map(item => <Link href={item.href} className={css.service} key={item.id}>
            <h3>{item.title}</h3><p>{item.text}</p>
            <span className={css.cardFoot}><span>დეტალების ნახვა</span><ChevronIcon size={18}/></span>
          </Link>)}</div>
        </section>;
      }
      return null;
    })}
  </div></div>;
}
