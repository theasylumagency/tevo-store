import type { Catalog, Product } from "@/lib/catalog";
import { t, type MessageKey } from "@/i18n";
import { formatSpec, groupProductSpecs } from "@/lib/catalog/product-presentation";
import { productCopy } from "@/i18n/product";
import styles from "./product.module.css";

export function SpecTable({ product, catalog }: { product: Product; catalog: Catalog }) {
  const groups = groupProductSpecs(product, catalog);
  if (!groups.length) return <div className={styles.specEmpty}>
    <p>{productCopy.specEmpty}</p><p>{productCopy.specHelp}</p>
  </div>;
  return (
    <div className={styles.specGroups}>
      {groups.map((group) => (
        <section key={group.key}>
          <h3 className={styles.specGroupTitle}>{t(`specs.group.${group.key}` as MessageKey)}</h3>
          <dl className={styles.specTable}>
            {group.specs.map((s, i) => (
              <div key={`${s.key}-${i}`} className={styles.specRow}>
                <dt>{s.label}</dt>
                <dd>{formatSpec(s)}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

export function Description({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className={`prose-desc ${styles.description}`}>
      {text.split(/\n{2,}/).filter((block) => block.trim()).map((block, i) => {
        const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
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
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-warn">{t("review.title")}</h2>
        <span className="font-mono text-warn">{t("review.score", { n: dq.score })}</span>
      </div>
      {dq.issues.length ? (
        <ul className="mb-3 list-disc space-y-0.5 pl-5">
          {dq.issues.map((i) => <li key={i}>{catalog.quality_issue_labels[i] ?? i}</li>)}
        </ul>
      ) : <p className="mb-3">{t("review.no_issues")}</p>}
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm text-ink-2">
        <dt>{t("review.legacy_name")}</dt><dd className="break-words text-ink">{product.name_legacy}</dd>
        <dt>{t("review.legacy_id")}</dt><dd className="break-words text-ink">{product.legacy_wp_id} · {product.id}</dd>
      </dl>
    </section>
  );
}
