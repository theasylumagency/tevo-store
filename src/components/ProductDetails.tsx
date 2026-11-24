import type { Catalog, Product } from "@/lib/catalog";
import { t, type MessageKey } from "@/i18n";

const GROUP_ORDER = ["engine", "drive", "work", "electric", "general", "other"];

export function SpecTable({ product, catalog }: { product: Product; catalog: Catalog }) {
  const groupOf = new Map(catalog.spec_vocabulary.map((s) => [s.key, s.group]));
  const groups = new Map<string, Product["specs"]>();
  for (const s of product.specs) {
    if (s.key === "model") continue;
    const g = groupOf.get(s.key) ?? "other";
    groups.set(g, [...(groups.get(g) ?? []), s]);
  }
  if (!groups.size) return null;
  return (
    <div className="space-y-5">
      {GROUP_ORDER.filter((g) => groups.has(g)).map((g) => (
        <div key={g}>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-2">{t(`specs.group.${g}` as MessageKey)}</h3>
          <dl className="divide-y divide-line rounded-card border border-line bg-surface">
            {groups.get(g)!.map((s) => (
              <div key={s.key} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 px-3 py-2 text-sm">
                <dt className="text-ink-2">{s.label}</dt>
                <dd className="font-medium">{s.value}{s.unit ? ` ${s.unit}` : ""}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

export function Description({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="prose-desc text-[15px]">
      {text.split(/\n{2,}/).map((block, i) => {
        const lines = block.split("\n");
        if (lines.every((l) => l.startsWith("- "))) {
          return <ul key={i}>{lines.map((l, k) => <li key={k}>{l.slice(2)}</li>)}</ul>;
        }
        return <p key={i}>{block}</p>;
      })}
    </div>
  );
}

export function ReviewPanel({ product, catalog }: { product: Product; catalog: Catalog }) {
  const dq = product.data_quality;
  return (
    <section className="rounded-card border border-warn/40 bg-warn-soft p-4 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold text-warn">{t("review.title")}</h2>
        <span className="font-mono text-warn">{t("review.score", { n: dq.score })}</span>
      </div>
      {dq.issues.length ? (
        <ul className="mb-3 list-disc space-y-0.5 pl-5">
          {dq.issues.map((i) => <li key={i}>{catalog.quality_issue_labels[i] ?? i}</li>)}
        </ul>
      ) : <p className="mb-3">{t("review.no_issues")}</p>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-ink-2">
        <dt>{t("review.legacy_name")}</dt><dd className="text-ink">{product.name_legacy}</dd>
        <dt>{t("review.legacy_id")}</dt><dd className="text-ink">{product.legacy_wp_id} · {product.id}</dd>
      </dl>
    </section>
  );
}
