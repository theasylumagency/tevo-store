"use client";

import { Suspense, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { reportDecisionEvent } from "@/lib/analytics/client";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { searchCatalog, type CatalogSearchIndex, type SearchDocument } from "@/lib/catalog/search";
import { formatNumber } from "@/lib/money";
import { navigationText as text } from "@/i18n/navigation";
import { ChevronIcon, CloseIcon, PackageIcon, SearchIcon } from "./StoreIcons";

const fieldClass = "h-12 min-w-0 flex-1 bg-transparent py-3 pl-11 pr-2 text-base text-ink outline-none placeholder:text-ink-2/80 lg:h-[52px]";
const shellClass = "flex items-center rounded-xl border border-line bg-bg transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15";
const searchHref = (query: string, exact = false) => `/search?${new URLSearchParams({ q: query, ...(exact ? { exact: "1" } : {}) }).toString()}`;

export function SearchBox({ index }: { index: CatalogSearchIndex }) {
  return <Suspense fallback={<SearchBoxFallback />}><SearchBoxWithLocation index={index} /></Suspense>;
}

function SearchBoxWithLocation({ index }: { index: CatalogSearchIndex }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const initialQuery = pathname === "/search" ? params.get("q") ?? "" : "";
  const initialExact = pathname === "/search" && params.get("exact") === "1";
  return <SearchBoxControl key={`${pathname}:${initialQuery}:${initialExact}`} index={index} initialQuery={initialQuery} initialExact={initialExact} />;
}

export function SearchBoxFallback() {
  return (
    <form action="/search" method="get" role="search" className="relative w-full" aria-label={text.search}>
      <div className={shellClass}>
        <span className="pointer-events-none absolute left-3.5 text-ink-2"><SearchIcon /></span>
        <input type="search" name="q" maxLength={120} aria-label={text.search} placeholder={text.searchPlaceholder} className={fieldClass} />
        <button className="mr-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink">{text.search}</button>
      </div>
    </form>
  );
}

type Suggestion = {
  key: string;
  href: string;
  label: string;
  kind: "category" | "product" | "all";
  item?: SearchDocument;
  count?: number;
};

function SearchBoxControl({ index, initialQuery, initialExact }: { index: CatalogSearchIndex; initialQuery: string; initialExact: boolean }) {
  const [value, setValue] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const id = useId();
  const query = value.trim();
  const exact = initialExact && query === initialQuery.trim();
  const result = useMemo(() => searchCatalog(index, query, { limit: 5, exact }), [index, query, exact]);
  const suggestions = useMemo<Suggestion[]>(() => {
    if (!query) {
      const preferred = ["MOTOBLOCK", "SPRAYER", "WATER_PUMP", "SPARE_PART"];
      return preferred.flatMap((id) => {
        const type = index.types.find((item) => item.id === id);
        return type ? [{ key: `type:${type.id}`, href: type.href, label: type.label, kind: "category" as const, count: type.count }] : [];
      });
    }
    const taxonomy = [...result.types, ...result.categories].slice(0, 3);
    return [
      ...taxonomy.map((item) => ({ key: `category:${item.href}`, href: item.href, label: item.label, kind: "category" as const, count: item.count })),
      ...result.products.map(({ item }) => ({ key: item.id, href: `/p/${item.slug}`, label: item.name, kind: "product" as const, item })),
      { key: "all", href: searchHref(query, exact), label: result.total ? text.allResults : text.searchExact, kind: "all" as const, count: result.total },
    ];
  }, [index, query, result, exact]);
  const listId = `${id}-suggestions`;
  const activeItem = active >= 0 ? suggestions[active] : undefined;

  // Preserve the query when Activity caches a route, but close transient UI.
  useLayoutEffect(() => {
    return () => {
      setOpen(false);
      setActive(-1);
    };
  }, []);

  useEffect(() => {
    if (open && active >= 0) document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, id]);

  function recordNavigation(kind: "all" | "product" | "category") {
    if (!query) return;
    if (kind === "product") void reportDecisionEvent("search_suggestion_product");
    else if (kind === "category") void reportDecisionEvent("search_suggestion_category");
    else if (initialQuery.trim() && query !== initialQuery.trim()) void reportDecisionEvent("search_reformulated");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query) {
      setOpen(true);
      inputRef.current?.focus();
      return;
    }
    setOpen(false);
    recordNavigation("all");
    router.push(searchHref(query, exact));
  }

  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      if (!suggestions.length) return;
      setActive((current) => event.key === "ArrowDown"
        ? (current + 1) % suggestions.length
        : (current <= 0 ? suggestions.length - 1 : current - 1));
    } else if (event.key === "Escape") {
      if (open) { event.preventDefault(); event.stopPropagation(); }
      setOpen(false);
      setActive(-1);
    } else if (event.key === "Enter" && open && activeItem) {
      event.preventDefault();
      setOpen(false);
      recordNavigation(activeItem.kind);
      router.push(activeItem.href);
    }
  }

  return (
    <form
      action="/search" method="get" role="search" aria-label={text.search}
      className="relative w-full" onSubmit={submit}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) { setOpen(false); setActive(-1); } }}
    >
      <div className={shellClass}>
        <span className="pointer-events-none absolute left-3.5 text-ink-2"><SearchIcon /></span>
        <input
          ref={inputRef} type="search" name="q" role="combobox" aria-label={text.search}
          aria-autocomplete="list" aria-expanded={open} aria-controls={open ? listId : undefined}
          aria-activedescendant={open && activeItem ? `${id}-option-${active}` : undefined}
          autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="search" maxLength={120}
          placeholder={text.searchPlaceholder} value={value}
          onFocus={() => setOpen(true)} onKeyDown={keyDown}
          onChange={(event) => { setValue(event.target.value); setActive(-1); setOpen(true); }}
          className={`${fieldClass} [&::-webkit-search-cancel-button]:appearance-none`}
          data-testid="header-search"
        />
        {value && <button type="button" aria-label={text.clearSearch} className="flex h-11 w-10 shrink-0 items-center justify-center rounded-lg text-ink-2 hover:text-ink"
          onClick={() => { setValue(""); setActive(-1); setOpen(true); inputRef.current?.focus(); }}><CloseIcon size={18} /></button>}
        <button type="submit" className="mr-1 flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent/90">{text.search}</button>
      </div>

      {open && (
        <div className="absolute inset-x-0 top-[calc(100%+8px)] z-50 max-h-[min(65dvh,580px)] overflow-y-auto overscroll-contain rounded-2xl border border-line bg-surface shadow-[0_18px_60px_-18px_rgba(29,31,28,0.32)]" data-testid="search-suggestions">
          {!query && <div className="border-b border-line px-4 py-3"><p className="text-sm font-semibold">{text.startWithCategory}</p><p className="mt-1 text-sm text-ink-2">{text.searchHint}</p></div>}
          {query && result.correction && <p className="border-b border-line bg-accent-soft/60 px-4 py-3 text-sm text-ink-2">{text.similarResults}: <strong className="font-semibold text-ink">{result.correction}</strong></p>}
          {query && !result.total && !result.types.length && !result.categories.length && <div className="px-4 py-5"><p className="font-semibold">{text.searchEmpty}</p><p className="mt-1 text-sm leading-relaxed text-ink-2">{text.searchEmptyHint}</p></div>}
          <ul id={listId} role="listbox" aria-label={text.search} className="p-1.5">
            {suggestions.map((suggestion, position) => (
              <li key={suggestion.key} role="presentation">
                {suggestion.kind === "product" && suggestions[position - 1]?.kind !== "product" && <p role="presentation" className="px-3 pb-2 pt-3 text-sm font-semibold text-ink-2">{text.searchProducts}</p>}
                <Link
                  id={`${id}-option-${position}`} href={suggestion.href} role="option" aria-selected={active === position} tabIndex={-1}
                  onPointerMove={() => setActive(position)}
                  onMouseDown={(event) => { if (!event.metaKey && !event.ctrlKey && !event.shiftKey) event.preventDefault(); }}
                  onNavigate={() => { recordNavigation(suggestion.kind); setOpen(false); setActive(-1); }}
                  className={`flex min-h-12 items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${active === position ? "bg-accent-soft" : "hover:bg-bg"} ${suggestion.kind === "all" ? "mt-1 border-t border-line font-semibold text-accent" : ""}`}
                >
                  {suggestion.kind === "product" && suggestion.item ? <SearchThumbnail item={suggestion.item} /> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg text-ink-2">{suggestion.kind === "all" ? <SearchIcon size={18} /> : <ChevronIcon size={16} />}</span>}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-relaxed">{suggestion.label}</span>
                    {suggestion.item && <span className="mt-0.5 block text-sm text-ink-2">{suggestion.item.price === null ? text.priceUnknown : `${formatNumber(suggestion.item.price)} ₾`}</span>}
                  </span>
                  {suggestion.count !== undefined && <span className="shrink-0 rounded-md bg-bg px-2 py-1 text-sm tabular-nums text-ink-2">{suggestion.count}</span>}
                </Link>
              </li>
            ))}
          </ul>
          <p className="hidden border-t border-line px-4 py-2.5 text-xs text-ink-2 lg:block">{text.keyboardHint}</p>
        </div>
      )}
      <span role="status" className="sr-only">{open && query ? `${result.total} ${text.products}` : ""}</span>
    </form>
  );
}

function SearchThumbnail({ item }: { item: SearchDocument }) {
  const [failed, setFailed] = useState(false);
  return <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-white text-ink-2">
    {item.image && !failed ? <Image src={item.image} alt="" width={56} height={56} sizes="56px" className="h-full w-full object-contain p-1" onError={() => setFailed(true)} /> : <PackageIcon size={24} />}
  </span>;
}
