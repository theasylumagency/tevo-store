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
import { formatPrice } from "@/lib/format";
import { t } from "@/i18n";
import css from "./home.module.css";

type Screen = "desktop" | "mobile";
function Photo({ file, options, available, priority, previewScreen }: {
  file: string; options: HomePhoto; available: Set<string>; priority: boolean; previewScreen?: Screen;
}) {
  const mobile = available.has(options.mobilePhoto) ? options.mobilePhoto : file;
  const style = { objectPosition: `${options.focalX}% ${options.focalY}%` };
  const sizes = "(max-width: 650px) 95vw, (max-width: 1200px) 43vw, 500px";
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
  function productCards(products: Product[]) {
    return <div className={css.products}>{products.map(p => <ProductCard key={p.id} p={p} available={available} showDetails
      brand={p.brand ? index.brands.get(p.brand) ?? p.brand : null} review={review}/>)}</div>;
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
  return <div className={css.home} data-home-preset={doc.preset}><div className={css.stack}>
    {!primaryOffer && <header className={css.hero} data-photo={!!introPhoto}>
      <div><h1>{doc.intro.title.trim() || initialHome().intro.title}</h1>{doc.intro.text && <p>{doc.intro.text}</p>}
        {introTarget && doc.intro.target.label && <Link className={css.cta} href={introTarget}>{doc.intro.target.label}</Link>}
      </div>
      {introPhoto && <Photo file={introPhoto} options={doc.intro} available={available} priority previewScreen={previewScreen}/>}
    </header>}
    {sections.map(({ key, fallback }) => {
      if (key === "catalog") return <section key={key} id="catalog" data-home-block={key} className="scroll-mt-6">
        <div className={css.sectionHead}><h2>{doc.catalogTitle}</h2>
          {doc.categoryIds.length > 0 && <Link href="/search">ყველა კატეგორია</Link>}
        </div>
        <div className={css.categories}>{categories.map(c => <div key={c.id} className={css.category}>
          <Link href={"/catalog/" + c.slug} className="flex items-baseline justify-between gap-3 font-semibold">
            {c.name}<span className="text-xs text-ink-2">{c.count}</span></Link>
          <ul className="mt-2 space-y-1 text-sm text-ink-2">{c.types.slice(0, 6).map(type => <li key={type.id}>
            <Link href={"/catalog/" + c.slug + "/" + type.slug}>{type.name}</Link></li>)}</ul></div>)}</div>
      </section>;
      if (key === "offer" && offer) {
        const candidate = available.has(doc.offer.photo) ? doc.offer.photo : mainImage(offer)?.file;
        const photo = candidate && available.has(candidate) ? candidate : available.has(doc.offer.mobilePhoto) ? doc.offer.mobilePhoto : "";
        const Heading = primaryOffer ? "h1" : "h2";
        return <section key={key} className={css.offer} data-home-block={key} data-photo={!!photo}>
          <div><p className={css.label}>{doc.offer.title.trim() || blockNames.offer}</p><Heading>{offer.name}</Heading>
            {doc.offer.text && <p>{doc.offer.text}</p>}<Price price={offer.price} size="lg"/>
            <p className={css.availability}>{t(`product.availability.${offer.availability.status}`)}</p>
            <Link className={css.cta} href={"/p/" + offer.slug}>პროდუქტის ნახვა</Link></div>
          {photo && <Photo file={photo} options={doc.offer} available={available} priority={primaryOffer} previewScreen={previewScreen}/>}
        </section>;
      }
      if (key === "guide") {
        const tasks = doc.guide.tasks.flatMap((task, i) => {
          const p = index.visible.find(p => homeEligible(p) && p.product_type === task.type);
          return p && task.title.trim() ? [<div key={i} className={css.task}>
            <h3><Link href={"/catalog/" + toSlug(p.category) + "/" + toSlug(task.type)}>{task.title}</Link></h3>
            {task.text && <p>{task.text}</p>}
            <Link href={"/catalog/" + toSlug(p.category) + "/" + toSlug(task.type)} className={css.textLink}>შესაბამისი პროდუქტები</Link>
          </div>] : [];
        });
        return tasks.length > 0 && <section key={key} data-home-block={key}><h2>{doc.guide.title.trim() || blockNames.guide}</h2><div className={css.tasks}>{tasks}</div></section>;
      }
      if (key === "picks" || key === "seasonal" || key === "popular") {
        const collection = key === "popular" ? null : doc[key];
        const products = key === "picks" ? picks : key === "seasonal" ? seasonal : popular;
        return <section key={key} data-home-block={key}><div className={css.sectionHead}>
          <h2>{fallback ? blockNames.picks : collection ? collection.title.trim() || blockNames[key] : doc.popularTitle.trim() || blockNames.popular}</h2>
          {collection?.mode === "type" && products.length > 0 && <Link href={"/catalog/" + toSlug(products[0].category) + "/" + toSlug(products[0].product_type) +
            (collection.sort === "price_asc" || collection.sort === "price_desc" ? "?sort=" + collection.sort : "")}>
            {collection.onlyInStock || collection.sort === "offers" ? "ამ ტიპის პროდუქტები" : "ყველას ნახვა"}
          </Link>}
        </div>
          {collection?.text && <p className="mb-4 text-ink-2">{collection.text}</p>}
          {key === "popular" && <p className="mb-4 text-sm text-ink-2">ბოლო 30 დღის დადასტურებული, გადახდილი შეკვეთების მიხედვით.</p>}
          {productCards(products)}</section>;
      }
      if (key === "advice") {
        const href = resolveHomeTarget(doc.advice.target, index.catalog);
        return href && <section key={key} data-home-block={key} className={css.advice}><div>
          <p className={css.label}>რჩევა არჩევისთვის</p><h2>{doc.advice.title}</h2><p>{doc.advice.text}</p>
          <Link className={css.cta} href={href}>{doc.advice.target.label}</Link>
        </div></section>;
      }
      if (key === "service") {
        const selected = doc.service.items.flatMap(id => services[id] ? [{ id, ...services[id]! }] : []);
        return selected.length > 0 && <section key={key} data-home-block={key}><h2>{doc.service.title}</h2>
          <div className={css.services}>{selected.map(item => <div className={css.service} key={item.id}>
            <h3><Link href={item.href}>{item.title}</Link></h3><p>{item.text}</p>
            <Link className={css.textLink} href={item.href}>დეტალების ნახვა</Link>
          </div>)}</div>
        </section>;
      }
      return null;
    })}
  </div></div>;
}
