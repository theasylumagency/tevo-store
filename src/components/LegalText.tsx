import { Fragment } from "react";
import type { StoreConfig } from "@/config/store";
import type { Block } from "@/content/legal";
import { t } from "@/i18n";

function lookup(store: StoreConfig, key: string): string | null {
  if (key === "site") return (process.env.PUBLIC_BASE_URL ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "") || null;
  const [group, field] = key.split(".") as ["legal" | "contact", string];
  const v = (store[group] as unknown as Record<string, string | null> | undefined)?.[field];
  return v ?? null;
}

/** Renders "{{legal.name}}"-style placeholders; a missing value shows up as a highlighted "შესავსებია". */
function Fill({ text, store }: { text: string; store: StoreConfig }) {
  const parts = text.split(/(\{\{[a-zA-Z.]+\}\})/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\{\{([a-zA-Z.]+)\}\}$/);
        if (!m) return <Fragment key={i}>{part}</Fragment>;
        const v = lookup(store, m[1]);
        return v ? <Fragment key={i}>{v}</Fragment>
          : <mark key={i} className="rounded bg-warn-soft px-1 text-warn">[{t("legal.placeholder")}: {m[1]}]</mark>;
      })}
    </>
  );
}

export function LegalText({ blocks, store }: { blocks: Block[]; store: StoreConfig }) {
  return (
    <div className="space-y-3 leading-7">
      {blocks.map((b, i) => (
        <Fragment key={i}>
          {b.h && <h2 className="pt-3 text-lg font-semibold">{b.h}</h2>}
          {b.p && <p><Fill text={b.p} store={store} /></p>}
          {b.ul && <ul className="list-disc space-y-1 pl-5">{b.ul.map((li, k) => <li key={k}><Fill text={li} store={store} /></li>)}</ul>}
        </Fragment>
      ))}
    </div>
  );
}
