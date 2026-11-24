"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Facet, SortKey } from "@/lib/catalog/filters";

type Labels = { title: string; from: string; to: string; apply: string; reset: string; sort: string;
  sorts: Record<SortKey, string> };

/** Facet panel + sort. Builds the URL itself; the server re-renders the listing from searchParams. */
export function Filters({ facets, pathname, current, sort, q, labels }: {
  facets: Facet[];
  pathname: string;
  current: Record<string, string[]>;
  sort: SortKey;
  q?: string;
  labels: Labels;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const price = facets.find((f) => f.kind === "price")?.range;
  const [from, setFrom] = useState(price?.from?.toString() ?? "");
  const [to, setTo] = useState(price?.to?.toString() ?? "");

  function go(next: Record<string, string[]>, nextSort = sort, pf = from, pt = to) {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    for (const [k, v] of Object.entries(next)) if (v.length) sp.set(k, v.join(","));
    if (pf) sp.set("price_from", pf);
    if (pt) sp.set("price_to", pt);
    if (nextSort !== "default") sp.set("sort", nextSort);
    const qs = sp.toString();
    start(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  function toggle(key: string, value: string) {
    const cur = current[key] ?? [];
    const v = cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value];
    go({ ...current, [key]: v });
  }

  const active = Object.values(current).some((v) => v.length) || from || to;

  return (
    <aside className={`space-y-5 text-sm transition-opacity ${pending ? "opacity-60" : ""}`}>
      <label className="block">
        <span className="mb-1 block text-xs text-ink-2">{labels.sort}</span>
        <select value={sort} onChange={(e) => go(current, e.target.value as SortKey)}
                className="w-full rounded-card border border-line bg-surface px-2 py-1.5">
          {(Object.keys(labels.sorts) as SortKey[]).map((s) => <option key={s} value={s}>{labels.sorts[s]}</option>)}
        </select>
      </label>

      {facets.map((f) =>
        f.kind === "price" && f.range ? (
          <fieldset key={f.key}>
            <legend className="mb-2 font-medium">{f.label}</legend>
            <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); go(current); }}>
              <div className="flex items-center gap-2">
                <input inputMode="numeric" value={from} onChange={(e) => setFrom(e.target.value)}
                       placeholder={`${Math.floor(f.range.min)}`} aria-label={labels.from}
                       className="w-0 flex-1 rounded border border-line bg-surface px-2 py-1" />
                <span className="text-ink-2">–</span>
                <input inputMode="numeric" value={to} onChange={(e) => setTo(e.target.value)}
                       placeholder={`${Math.ceil(f.range.max)}`} aria-label={labels.to}
                       className="w-0 flex-1 rounded border border-line bg-surface px-2 py-1" />
              </div>
              <button className="w-full rounded border border-line py-1 hover:border-accent">{labels.apply}</button>
            </form>
          </fieldset>
        ) : (
          <fieldset key={f.key}>
            <legend className="mb-2 font-medium">{f.kind === "bool" ? "" : f.label}</legend>
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {f.options.map((o) => (
                <li key={o.value}>
                  <label className={`flex cursor-pointer items-center gap-2 ${o.count === 0 && !f.selected.includes(o.value) ? "opacity-40" : ""}`}>
                    <input type="checkbox" checked={f.selected.includes(o.value)} onChange={() => toggle(f.key, o.value)}
                           className="accent-[var(--accent)]" />
                    <span className="flex-1">{o.label}</span>
                    <span className="text-xs text-ink-2">{o.count}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        ),
      )}

      {active && (
        <button onClick={() => { setFrom(""); setTo(""); go({}, sort, "", ""); }}
                className="text-xs text-accent underline">{labels.reset}</button>
      )}
    </aside>
  );
}
