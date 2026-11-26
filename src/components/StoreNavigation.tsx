"use client";

import Link from "next/link";
import { useId, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import type { CatalogSearchIndex } from "@/lib/catalog/search";
import { navigationText as text } from "@/i18n/navigation";
import { CartLink } from "./cart/CartLink";
import { OverlayDialog } from "./OverlayDialog";
import { SearchBox } from "./SearchBox";
import { CategoryIcon, ChevronIcon, CloseIcon, GridIcon } from "./StoreIcons";

export interface NavigationCategory {
  id: string;
  slug: string;
  name: string;
  count: number;
  types: { id: string; slug: string; name: string; count: number }[];
}

const categoryHref = (category: NavigationCategory) => `/catalog/${category.slug}`;
const typeHref = (category: NavigationCategory, type: NavigationCategory["types"][number]) => `${categoryHref(category)}/${type.slug}`;

export function StoreNavigation({ storeName, nav, searchIndex }: {
  storeName: string;
  nav: NavigationCategory[];
  searchIndex: CatalogSearchIndex;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [mobileCategory, setMobileCategory] = useState<string | null>(null);
  const lastMobileCategory = useRef<string | null>(null);
  const dialogId = useId();

  useLayoutEffect(() => {
    return () => {
      setOpen(false);
      setMobileCategory(null);
      lastMobileCategory.current = null;
    };
  }, []);

  const desktopCategory = nav.find((category) => category.id === selected) ?? nav[0];
  const mobileCurrent = nav.find((category) => category.id === mobileCategory);
  const types = nav.flatMap((category) => category.types.map((type) => ({ ...type, href: typeHref(category, type) })));
  const quickLinks = [
    { id: "MOTOBLOCK", label: text.motoblocks },
    { id: "SPRAYER", label: text.sprayers },
    { id: "WATER_PUMP", label: text.pumps },
    { id: "GENERATOR", label: text.generators },
    { id: "SPARE_PART", label: text.spareParts },
  ].flatMap((item) => {
    const type = types.find((type) => type.id === item.id);
    return type ? [{ ...item, href: type.href }] : [];
  });

  function close() { setOpen(false); }
  function openCatalog(event: MouseEvent<HTMLButtonElement>) {
    // Some touch browsers do not focus clicked buttons. Restore focus to the
    // catalog trigger on close, rather than reopening a previously focused search.
    event.currentTarget.focus({ preventScroll: true });
    setMobileCategory(null);
    lastMobileCategory.current = null;
    setOpen(true);
  }

  return (
    <div className="relative z-40 bg-surface">
      <div className="mx-auto grid max-w-7xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 px-4 py-4 lg:grid-cols-[auto_auto_minmax(280px,1fr)_auto] lg:gap-x-6 lg:py-5">
        <Link href="/" aria-label={`${storeName} — მთავარი`} className="col-start-2 row-start-1 max-w-full truncate justify-self-center text-2xl font-bold tracking-tight lg:col-start-1 lg:justify-self-start lg:pr-2 lg:text-[28px]">{storeName}</Link>
        <button type="button" onClick={openCatalog} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? dialogId : undefined}
          className="col-start-1 row-start-1 flex min-h-12 items-center justify-self-start gap-2 rounded-xl border border-line bg-surface px-3 text-sm font-semibold transition-colors hover:bg-bg lg:col-start-2 lg:gap-2.5 lg:border-ink lg:bg-ink lg:px-4 lg:text-white lg:hover:bg-ink/90"
          data-testid="catalog-trigger">
          <GridIcon size={19} /><span>{text.catalog}</span><ChevronIcon size={15} className="hidden rotate-90 lg:block" />
        </button>
        <div className="col-span-3 row-start-2 min-w-0 lg:col-span-1 lg:col-start-3 lg:row-start-1"><SearchBox index={searchIndex} /></div>
        <div className="col-start-3 row-start-1 justify-self-end lg:col-start-4 [&_a]:min-h-12 [&_a]:min-w-12 [&_a]:justify-center [&_a]:rounded-xl"><CartLink /></div>
      </div>
      <div className="hidden border-t border-line/70 lg:block">
        <div className="mx-auto flex min-h-12 max-w-7xl items-center justify-between gap-5 px-4">
          <nav aria-label="სწრაფი გადასვლა" className="flex min-w-0 items-center gap-5 xl:gap-7">
            {quickLinks.map((item, i) => <Link key={item.id} href={item.href} className={`${i > 2 ? "hidden xl:flex" : "flex"} min-h-11 items-center whitespace-nowrap text-sm text-ink-2 transition-colors hover:text-accent`}>{item.label}</Link>)}
          </nav>
          <Link href="/info/contact" className="flex min-h-11 shrink-0 items-center text-sm font-medium text-ink-2 underline decoration-line underline-offset-4 hover:text-accent">{text.contact}</Link>
        </div>
      </div>

      <OverlayDialog id={dialogId} open={open} onClose={close} labelledBy={`${dialogId}-title`} className="inset-y-0 left-0 m-0 h-dvh w-full max-w-[440px] rounded-none lg:inset-x-4 lg:top-8 lg:bottom-auto lg:mx-auto lg:h-auto lg:max-h-[calc(100dvh-64px)] lg:w-[calc(100%-32px)] lg:max-w-[1050px] lg:rounded-2xl">
        <div className="flex h-full min-h-0 flex-col lg:max-h-[calc(100dvh-64px)]">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-4 lg:px-6 lg:py-5">
            <div>
              <h2 id={`${dialogId}-title`} className="text-xl font-bold">{text.catalog}</h2>
              <p className="mt-1 text-sm text-ink-2">{text.catalogHint}</p>
            </div>
            <button type="button" onClick={close} aria-label={text.closeCatalog} data-dialog-autofocus className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line text-ink-2 transition-colors hover:bg-bg"><CloseIcon /></button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain lg:hidden">
            {mobileCurrent ? (
              <div className="p-5">
                <button type="button" onClick={() => { lastMobileCategory.current = mobileCurrent.id; setMobileCategory(null); }} ref={(node) => { if (node) node.focus(); }} className="mb-5 flex min-h-11 items-center gap-2 text-sm font-medium text-ink-2"><ChevronIcon size={16} className="rotate-180" />{text.catalogAll}</button>
                <div className="mb-5 flex items-center gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><CategoryIcon category={mobileCurrent.id} size={25} /></span><div><h3 className="text-lg font-bold leading-snug">{mobileCurrent.name}</h3><p className="mt-1 text-sm text-ink-2">{mobileCurrent.count} {text.products}</p></div></div>
                <Link href={categoryHref(mobileCurrent)} onNavigate={close} className="mb-4 flex min-h-12 items-center justify-center rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink">{text.categoryAll}</Link>
                <nav aria-label={mobileCurrent.name} className="divide-y divide-line">
                  {mobileCurrent.types.map((type) => <Link key={type.id} href={typeHref(mobileCurrent, type)} onNavigate={close} className="flex min-h-16 items-center justify-between gap-3 py-3 text-base"><span>{type.name}</span><span className="rounded-md bg-bg px-2 py-1 text-sm text-ink-2">{type.count}</span></Link>)}
                </nav>
              </div>
            ) : (
              <nav aria-label={text.catalogAll} className="p-2.5">
                {nav.map((category) => <button key={category.id} type="button" onClick={() => setMobileCategory(category.id)}
                  ref={(node) => { if (node && lastMobileCategory.current === category.id) { node.focus(); lastMobileCategory.current = null; } }}
                  className="flex min-h-[74px] w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-bg">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-bg text-ink-2"><CategoryIcon category={category.id} size={24} /></span>
                  <span className="min-w-0 flex-1"><span className="block text-base font-medium leading-snug">{category.name}</span><span className="mt-1 block text-sm text-ink-2">{category.count} {text.products}</span></span>
                  <ChevronIcon size={17} className="shrink-0 text-ink-2" />
                </button>)}
              </nav>
            )}
          </div>

          {desktopCategory && <div className="hidden min-h-0 flex-1 grid-cols-[310px_1fr] overflow-y-auto lg:grid">
            <nav aria-label={text.catalogAll} className="border-r border-line bg-bg/70 p-3">
              {nav.map((category) => <button type="button" key={category.id} onClick={() => setSelected(category.id)} aria-pressed={desktopCategory.id === category.id}
                className={`flex min-h-[62px] w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition-colors ${desktopCategory.id === category.id ? "bg-surface font-semibold text-accent shadow-sm" : "text-ink-2 hover:bg-surface"}`}>
                <CategoryIcon category={category.id} size={22} className="shrink-0" />
                <span className="flex-1 leading-relaxed">{category.name}</span>
                <ChevronIcon size={15} className={`shrink-0 ${desktopCategory.id === category.id ? "opacity-100" : "opacity-35"}`} />
              </button>)}
            </nav>
            <section aria-label={desktopCategory.name} className="p-7">
              <div className="flex items-start justify-between gap-4 border-b border-line pb-5">
                <div><h3 className="text-xl font-bold leading-relaxed">{desktopCategory.name}</h3><p className="mt-1 text-sm text-ink-2">{desktopCategory.count} {text.products}</p></div>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><CategoryIcon category={desktopCategory.id} size={27} /></span>
              </div>
              <nav aria-label={desktopCategory.name} className="my-5 grid grid-cols-2 gap-3">
                {desktopCategory.types.map((type) => <Link key={type.id} href={typeHref(desktopCategory, type)} onNavigate={close} className="group min-h-24 rounded-xl border border-line p-4 transition-colors hover:border-accent/40 hover:bg-accent-soft/40"><span className="block text-base font-semibold leading-relaxed group-hover:text-accent">{type.name}</span><span className="mt-2 block text-sm text-ink-2">{type.count} {text.products}</span></Link>)}
              </nav>
              <Link href={categoryHref(desktopCategory)} onNavigate={close} className="inline-flex min-h-11 items-center rounded-xl bg-accent-soft px-4 text-sm font-semibold text-accent hover:bg-accent-soft/70">{text.categoryAll}</Link>
            </section>
          </div>}

          <nav aria-label="მომხმარებლის დახმარება" className="flex shrink-0 flex-wrap gap-x-5 gap-y-1 border-t border-line bg-bg/60 px-5 py-3 lg:px-6">
            <Link href="/info/delivery" onNavigate={close} className="flex min-h-11 items-center text-sm text-ink-2 hover:text-accent">{text.delivery}</Link>
            <Link href="/info/contact" onNavigate={close} className="flex min-h-11 items-center text-sm text-ink-2 hover:text-accent">{text.contact}</Link>
          </nav>
        </div>
      </OverlayDialog>
    </div>
  );
}
