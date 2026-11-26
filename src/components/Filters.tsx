"use client";

import { useRouter } from "next/navigation";
import { useId, useLayoutEffect, useOptimistic, useState, useTransition, type ReactNode } from "react";
import type { Facet, ListingQuery, SortKey } from "@/lib/catalog/filters";
import { activeFilterCount, countFacetOptions, listingHref, matchesFacetRecord, readPriceRange, withoutFilters, type FacetRecord } from "@/lib/catalog/filter-state";
import { t } from "@/i18n";
import { OverlayDialog } from "./OverlayDialog";

function FilterIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true" className="h-5 w-5"><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="2.5" className="fill-surface" /><circle cx="15" cy="17" r="2.5" className="fill-surface" /></svg>;
}
function CloseIcon({ small = false }: { small?: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true" className={small ? "h-3.5 w-3.5" : "h-5 w-5"}><path d="m6 6 12 12M18 6 6 18" /></svg>;
}
function Chevron() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className="h-4 w-4"><path d="m5 7.5 5 5 5-5" /></svg>;
}

function PriceInputs({ from, to, setFrom, setTo, range, onSubmit, draft = false }: {
  from: string; to: string; setFrom: (value: string) => void; setTo: (value: string) => void;
  range: NonNullable<Facet["range"]>; onSubmit?: () => void; draft?: boolean;
}) {
  const [attempted, setAttempted] = useState(false);
  const errorId = useId();
  const result = readPriceRange(from, to);
  const invalid = !result.valid && attempted;
  return (
    <form onSubmit={(event) => { event.preventDefault(); setAttempted(true); if (result.valid) onSubmit?.(); }} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="block min-w-0">
          <span className="mb-1.5 block text-sm text-ink-2">{t("filters.from")}</span>
          <div className="relative"><input inputMode="decimal" value={from} onChange={(e) => setFrom(e.target.value)} onBlur={() => { if (draft) setAttempted(true); }} placeholder={String(Math.floor(range.min))} aria-label={t("filters.price_from")} aria-invalid={invalid || undefined} aria-describedby={invalid ? errorId : undefined} className="min-h-11 w-full rounded-xl border border-line bg-surface py-2.5 pl-3 pr-7 text-base outline-none focus:border-accent" /><span className="pointer-events-none absolute right-3 top-3 text-sm text-ink-2">₾</span></div>
        </label>
        <label className="block min-w-0">
          <span className="mb-1.5 block text-sm text-ink-2">{t("filters.to")}</span>
          <div className="relative"><input inputMode="decimal" value={to} onChange={(e) => setTo(e.target.value)} onBlur={() => { if (draft) setAttempted(true); }} placeholder={String(Math.ceil(range.max))} aria-label={t("filters.price_to")} aria-invalid={invalid || undefined} aria-describedby={invalid ? errorId : undefined} className="min-h-11 w-full rounded-xl border border-line bg-surface py-2.5 pl-3 pr-7 text-base outline-none focus:border-accent" /><span className="pointer-events-none absolute right-3 top-3 text-sm text-ink-2">₾</span></div>
        </label>
      </div>
      {invalid && <p id={errorId} role="alert" className="text-sm leading-relaxed text-warn">{t(result.reason === "order" ? "filters.price_order" : "filters.price_number")}</p>}
      {!draft && <button type="submit" className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium transition-colors hover:border-accent hover:text-accent">{t("filters.apply")}</button>}
    </form>
  );
}

function DesktopPrice({ facet, query, go }: { facet: Facet; query: ListingQuery; go: (query: ListingQuery) => void }) {
  const [from, setFrom] = useState(query.priceFrom?.toString() ?? "");
  const [to, setTo] = useState(query.priceTo?.toString() ?? "");
  return <PriceInputs from={from} to={to} setFrom={setFrom} setTo={setTo} range={facet.range!} onSubmit={() => {
    const range = readPriceRange(from, to);
    if (range.valid) go({ ...query, priceFrom: range.from, priceTo: range.to });
  }} />;
}

function FacetOptions({ facet, selected, counts, onToggle, disabled }: {
  facet: Facet; selected: string[]; counts?: Map<string, number>;
  onToggle: (value: string) => void; disabled: boolean;
}) {
  const [term, setTerm] = useState("");
  const [expanded, setExpanded] = useState(false);
  const options = facet.options.filter((option) => option.label.toLocaleLowerCase("ka").includes(term.toLocaleLowerCase("ka")));
  const visible = term || expanded ? options : options.filter((option, index) => index < 6 || selected.includes(option.value));
  return (
    <div>
      {facet.options.length > 8 && <input type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t("filters.search_options")} aria-label={`${facet.label}: ${t("filters.search_options")}`} className="mb-2 min-h-11 w-full rounded-xl border border-line bg-bg/60 px-3 text-sm outline-none focus:border-accent" />}
      <ul>
        {visible.map((option) => {
          const checked = selected.includes(option.value);
          const count = counts?.get(option.value) ?? (counts ? 0 : option.count);
          const unavailable = count === 0 && !checked;
          return <li key={option.value}>
            <label className={`flex min-h-11 items-center gap-3 rounded-lg px-1.5 py-2 transition-colors ${unavailable ? "cursor-not-allowed text-ink-2/55" : "cursor-pointer hover:bg-bg"}`}>
              <input type="checkbox" checked={checked} disabled={disabled || unavailable} onChange={() => onToggle(option.value)} className="h-[18px] w-[18px] shrink-0 accent-[var(--accent)]" />
              <span className="min-w-0 flex-1 text-sm leading-5">{option.label}</span>
              <span aria-label={`${count} პროდუქტი`} className="shrink-0 text-sm tabular-nums text-ink-2">{count}</span>
            </label>
          </li>;
        })}
      </ul>
      {!options.length && <p className="py-3 text-sm text-ink-2">{t("filters.no_options")}</p>}
      {!term && options.length > 6 && <button type="button" onClick={() => setExpanded(!expanded)} className="min-h-11 px-1.5 py-2 text-sm font-medium text-accent hover:underline">{expanded ? t("filters.show_less") : t("filters.show_all", { n: options.length })}</button>}
    </div>
  );
}

function toggleFacet(query: ListingQuery, key: string, value: string): ListingQuery {
  const previous = query.filters[key] ?? [];
  const values = previous.includes(value) ? previous.filter((item) => item !== value) : [...previous, value];
  if (key === "type") return { ...query, filters: { type: values, ...(query.filters.brand?.length ? { brand: query.filters.brand } : {}) } };
  return { ...query, filters: { ...query.filters, [key]: values } };
}

function PriceChip({ query }: { query: ListingQuery }) {
  if (query.priceFrom !== undefined && query.priceTo !== undefined) return t("filters.price_range", { from: query.priceFrom, to: query.priceTo });
  return query.priceFrom !== undefined ? t("filters.price_min", { n: query.priceFrom }) : t("filters.price_max", { n: query.priceTo! });
}

/** Desktop facets and a draft-based mobile sheet share the same URL and counting rules. */
export function Filters({ facets, typeFacets, defaultType, records, pathname, query, resultCount, children }: {
  facets: Facet[]; typeFacets: Record<string, Facet[]>; defaultType?: string;
  records: FacetRecord[]; pathname: string; query: ListingQuery; resultCount: number; children: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(query, (_previous, next: ListingQuery) => next);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(query);
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  // Next preserves hidden routes with Activity; only the committed URL filters
  // should survive navigation, not an open sheet with an unapplied draft.
  useLayoutEffect(() => () => setOpen(false), []);
  const committedHref = listingHref(pathname, query);
  const [previousHref, setPreviousHref] = useState(committedHref);
  if (previousHref !== committedHref) {
    setPreviousHref(committedHref);
    setOpen(false);
  }
  const dialogTitleId = useId();
  const selectedCount = activeFilterCount(optimistic);
  const parsedDraft = readPriceRange(draftFrom, draftTo);
  const draftQuery = parsedDraft.valid ? { ...draft, priceFrom: parsedDraft.from, priceTo: parsedDraft.to } : draft;
  const draftCount = records.filter((record) => matchesFacetRecord(record, draftQuery)).length;
  const orderedFacets = [...facets].sort((a, b) => {
    const order = (key: string) => key === "type" ? 0 : key === "brand" ? 1 : key === "price" ? 2 : 3;
    return order(a.key) - order(b.key);
  });
  const draftTypes = draft.filters.type ?? [];
  const draftType = draftTypes.length === 1 ? draftTypes[0] : draftTypes.length ? undefined : defaultType;
  const mobileFacets = [
    ...orderedFacets.filter((facet) => ["type", "brand", "price"].includes(facet.key)),
    ...(draftType ? typeFacets[draftType] ?? [] : []),
  ];

  function go(next: ListingQuery) {
    startTransition(() => {
      setOptimistic(next);
      router.push(listingHref(pathname, next), { scroll: false });
    });
  }
  function openFilters() {
    if (pending) return;
    setDraft(query);
    setDraftFrom(query.priceFrom?.toString() ?? "");
    setDraftTo(query.priceTo?.toString() ?? "");
    setOpen(true);
  }
  function clearDraft() {
    setDraft(withoutFilters(draft));
    setDraftFrom("");
    setDraftTo("");
  }
  const chips = Object.entries(optimistic.filters).flatMap(([key, values]) => values.map((value) => ({
    key, value, label: facets.find((facet) => facet.key === key)?.options.find((option) => option.value === value)?.label ?? value,
  })));

  return (
    <div className="catalog-controls grid items-start gap-7 lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-8">
      <aside aria-label={t("filters.title")} className="hidden overflow-hidden rounded-2xl border border-line bg-surface lg:block">
        <div className="flex items-start justify-between gap-2 border-b border-line px-5 py-5">
          <div><h2 className="text-base font-semibold">{t("filters.title")}</h2><p className="mt-1 text-sm text-ink-2">{t("filters.refine")}</p></div>
          {selectedCount > 0 && <button type="button" disabled={pending} onClick={() => go(withoutFilters(optimistic))} className="min-h-11 text-sm font-medium text-accent hover:underline">{t("filters.clear")}</button>}
        </div>
        <div className="divide-y divide-line px-5">
          {orderedFacets.map((facet, index) => <details key={facet.key} open={index < 3 || (optimistic.filters[facet.key]?.length ?? 0) > 0 || facet.kind === "bool"} className="group py-1">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
              <span>{facet.label}</span><span className="text-ink-2 transition-transform group-open:rotate-180"><Chevron /></span>
            </summary>
            <div className="pb-4">
              {facet.kind === "price" && facet.range ? <DesktopPrice key={`${optimistic.priceFrom ?? ""}:${optimistic.priceTo ?? ""}`} facet={facet} query={optimistic} go={go} /> : <FacetOptions facet={facet} selected={optimistic.filters[facet.key] ?? []} onToggle={(value) => go(toggleFacet(optimistic, facet.key, value))} disabled={pending} />}
            </div>
          </details>)}
        </div>
      </aside>

      <section className="min-w-0" aria-label={t("search.results_list")} aria-busy={pending}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
          <p className="mr-auto text-sm font-medium text-ink"><span className="text-base font-semibold tabular-nums">{resultCount}</span> პროდუქტი</p>
          <button type="button" onClick={openFilters} aria-disabled={pending || undefined} aria-haspopup="dialog" aria-expanded={open} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm font-medium transition-colors hover:border-accent aria-disabled:opacity-50 lg:hidden"><FilterIcon />{t("filters.title")}{selectedCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs text-accent-ink">{selectedCount}</span>}</button>
          <label className="relative flex min-h-11 items-center gap-2 text-sm">
            <span className="hidden text-ink-2 xl:inline">{t("sort.label")}</span>
            <select aria-label={t("sort.label")} value={optimistic.sort} disabled={pending} onChange={(e) => go({ ...optimistic, sort: e.target.value as SortKey })} className="min-h-11 max-w-full appearance-none rounded-xl border border-line bg-surface py-2.5 pl-3 pr-9 text-sm outline-none focus:border-accent">
              <option value="default">{t(query.q ? "sort.relevance" : "sort.default")}</option>
              <option value="price_asc">{t("sort.price_asc")}</option><option value="price_desc">{t("sort.price_desc")}</option><option value="name">{t("sort.name")}</option>
            </select><span className="pointer-events-none absolute right-3 text-ink-2"><Chevron /></span>
          </label>
        </div>
        {selectedCount > 0 && <div aria-label={t("filters.selected")} className="mb-5 flex flex-wrap items-center gap-2">
          {chips.map((chip) => <button key={`${chip.key}:${chip.value}`} type="button" disabled={pending} onClick={() => go(toggleFacet(optimistic, chip.key, chip.value))} aria-label={t("filters.remove", { label: chip.label })} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-accent/15 bg-accent-soft px-3.5 text-sm text-accent transition-colors hover:border-accent"><span>{chip.label}</span><CloseIcon small /></button>)}
          {(optimistic.priceFrom !== undefined || optimistic.priceTo !== undefined) && <button type="button" disabled={pending} onClick={() => go({ ...optimistic, priceFrom: undefined, priceTo: undefined })} aria-label={t("filters.remove", { label: t("filters.price") })} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-accent/15 bg-accent-soft px-3.5 text-sm text-accent"><PriceChip query={optimistic} /><CloseIcon small /></button>}
          <button type="button" disabled={pending} onClick={() => go(withoutFilters(optimistic))} className="min-h-11 px-2 text-sm text-ink-2 underline underline-offset-4 hover:text-ink">{t("listing.reset")}</button>
        </div>}
        <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">{pending ? t("filters.updating") : t("filters.results_ready", { n: resultCount })}</p>
        {pending && <p className="mb-3 text-sm font-medium text-accent">{t("filters.updating")}</p>}
        <div className={`transition-opacity motion-reduce:transition-none ${pending ? "opacity-55" : ""}`}>{children}</div>
      </section>

      <OverlayDialog open={open} onClose={() => setOpen(false)} labelledBy={dialogTitleId} className="fixed inset-y-0 right-0 left-auto m-0 flex h-dvh max-h-dvh w-full max-w-md flex-col rounded-none bg-surface shadow-2xl sm:rounded-l-3xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div><h2 id={dialogTitleId} className="text-xl font-semibold">{t("filters.title")}</h2><p className="mt-1 text-sm text-ink-2">{t("filters.refine")}</p></div>
          <button type="button" data-dialog-autofocus aria-label={t("filters.close")} onClick={() => setOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-full bg-bg hover:bg-line"><CloseIcon /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5">
          <div className="divide-y divide-line">
            {mobileFacets.map((facet, index) => <details key={facet.key} open={index < 3 || (draft.filters[facet.key]?.length ?? 0) > 0 || facet.kind === "bool"} className="group py-1">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 py-3 text-base font-semibold [&::-webkit-details-marker]:hidden"><span>{facet.label}</span><span className="text-ink-2 transition-transform group-open:rotate-180"><Chevron /></span></summary>
              <div className="pb-4">{facet.kind === "price" && facet.range ? <PriceInputs draft from={draftFrom} to={draftTo} setFrom={setDraftFrom} setTo={setDraftTo} range={facet.range} /> : <FacetOptions facet={facet} selected={draft.filters[facet.key] ?? []} counts={countFacetOptions(records, draftQuery, facet.key)} onToggle={(value) => setDraft(toggleFacet(draft, facet.key, value))} disabled={false} />}</div>
            </details>)}
          </div>
        </div>
        <div className="shrink-0 border-t border-line bg-surface px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mb-3 flex items-center justify-between gap-3"><p role="status" className="text-sm text-ink-2">{parsedDraft.valid ? t("filters.results_ready", { n: draftCount }) : t("filters.price_pending")}</p><button type="button" onClick={clearDraft} className="min-h-11 text-sm font-medium text-accent hover:underline">{t("filters.clear")}</button></div>
          <button type="button" disabled={!parsedDraft.valid} onClick={() => { go(draftQuery); setOpen(false); }} className="min-h-12 w-full rounded-xl bg-accent px-4 py-3 text-base font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50">{t("filters.show", { n: draftCount })}</button>
        </div>
      </OverlayDialog>
    </div>
  );
}
