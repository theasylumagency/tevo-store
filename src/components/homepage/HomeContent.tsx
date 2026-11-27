import Link from "next/link";
import Image from "next/image";
import { cacheLife, cacheTag } from "next/cache";
import { getIndex, getNavigation, mainImage, toSlug, type Product } from "@/lib/catalog";
import { getAvailableMedia } from "@/lib/media";
import { getStore } from "@/config/store";
import { getTopSellers } from "@/lib/homepage/cache";
import { homeSelection } from "@/lib/homepage/selection";
import { blockNames, type HomeDocument } from "@/lib/homepage/model";
import { ProductCard } from "@/components/ProductCard";
import { Price } from "@/components/Price";
import css from "./home.module.css";

function Photo({ file, priority }: { file: string; priority: boolean }) {
  return <div className={css.photo}><Image src={"/media/" + file} alt="" fill preload={priority}
    sizes="(max-width: 650px) 95vw, (max-width: 1200px) 43vw, 500px" className="object-contain" /></div>;
}

export async function HomeContent({ doc, offerOpen }: { doc: HomeDocument; offerOpen: boolean }) {
  "use cache";
  if (doc.layouts[doc.preset].includes("popular")) { cacheLife("minutes"); cacheTag("home-sales"); }
  else cacheLife("hours");
  cacheTag("catalog", "media", "homepage");
  const [index, nav, media, sales] = await Promise.all([getIndex(), getNavigation(), getAvailableMedia(),
    doc.layouts[doc.preset].includes("popular") ? getTopSellers() : []]);
  const { offer, picks, popular, sections } = homeSelection(doc, index.visible, sales, offerOpen);
  const available = new Set(media);
  const review = getStore().showReview;
  const introPhoto = available.has(doc.intro.photo) ? doc.intro.photo : "";
  function productCards(products: Product[]) {
    return <div className={css.products}>{products.map(p => <ProductCard key={p.id} p={p} available={available}
      brand={p.brand ? index.brands.get(p.brand) ?? p.brand : null} review={review}/>)}</div>;
  }
  const primaryOffer = doc.preset === "offer" && !!offer;
  return <div className={css.home} data-home-preset={doc.preset}><div className={css.stack}>
    {!primaryOffer && <header className={css.hero} data-photo={!!introPhoto}>
      <div><h1>{doc.intro.title}</h1>{doc.intro.text && <p>{doc.intro.text}</p>}</div>
      {introPhoto && <Photo file={introPhoto} priority/>}
    </header>}
    {sections.map(({ key, fallback }) => {
      if (key === "catalog") return <section key={key} id="catalog" className="scroll-mt-6">
        <h2>{doc.catalogTitle}</h2><div className={css.categories}>{nav.map(c => <div key={c.id} className={css.category}>
          <Link href={"/catalog/" + c.slug} className="flex items-baseline justify-between gap-3 font-semibold">
            {c.name}<span className="text-xs text-ink-2">{c.count}</span></Link>
          <ul className="mt-2 space-y-1 text-sm text-ink-2">{c.types.slice(0, 6).map(type => <li key={type.id}>
            <Link href={"/catalog/" + c.slug + "/" + type.slug}>{type.name}</Link></li>)}</ul></div>)}</div>
      </section>;
      if (key === "offer" && offer) {
        const photo = available.has(doc.offer.photo) ? doc.offer.photo : mainImage(offer)?.file;
        const Heading = primaryOffer ? "h1" : "h2";
        return <section key={key} className={css.offer} data-photo={!!photo && available.has(photo)}>
          <div><p className={css.label}>{doc.offer.title}</p><Heading>{offer.name}</Heading>
            {doc.offer.text && <p>{doc.offer.text}</p>}<Price price={offer.price} size="lg"/>
            <Link className={css.cta} href={"/p/" + offer.slug}>პროდუქტის ნახვა</Link></div>
          {photo && available.has(photo) && <Photo file={photo} priority={primaryOffer}/>}
        </section>;
      }
      if (key === "guide") {
        const tasks = doc.guide.tasks.flatMap((task, i) => {
          const p = index.visible.find(p => p.product_type === task.type);
          return p ? [<div key={i} className={css.task}>
            <h3><Link href={"/catalog/" + toSlug(p.category) + "/" + toSlug(task.type)}>{task.title}</Link></h3>
            {task.text && <p>{task.text}</p>}
            <Link href={"/p/" + p.slug} className="text-sm text-accent underline">{p.name}</Link>
          </div>] : [];
        });
        return tasks.length > 0 && <section key={key}><h2>{doc.guide.title}</h2><div className={css.tasks}>{tasks}</div></section>;
      }
      if (key === "picks" || key === "popular") {
        const selected = key === "picks";
        return <section key={key}><div className={css.sectionHead}><h2>{fallback ? blockNames.picks : selected ? doc.picks.title : doc.popularTitle}</h2>
          {selected && doc.picks.mode === "type" && picks.length > 0 && <Link href={"/catalog/" + toSlug(picks[0].category) + "/" + toSlug(picks[0].product_type)}>ყველას ნახვა</Link>}</div>
          {selected && doc.picks.text && <p className="mb-4 text-ink-2">{doc.picks.text}</p>}
          {productCards(selected ? picks : popular)}</section>;
      }
      return null;
    })}
  </div></div>;
}
