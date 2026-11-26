"use client";

import { useActionState, useState } from "react";
import { saveDraftAction } from "@/app/actions/catalog";
import type { PriceRule, ProductEdits } from "@/lib/catalog/publication";
import type { Product } from "@/lib/catalog/types";
import { field, button, primary } from "./styles";

export function RuleFields({ rule, inheritLabel }: { rule?: PriceRule | null; inheritLabel: string }) {
  const [kind, setKind] = useState(rule?.kind ?? "inherit");
  return <div className="flex flex-wrap items-end gap-3">
    <label className="block flex-1 text-sm">ფასის წესი
      <select name="kind" value={kind} onChange={e => setKind(e.target.value)} className={field}>
        <option value="inherit">{inheritLabel}</option><option value="percent">პროცენტული დანამატი</option>
        <option value="fixed">ფიქსირებული დანამატი</option>
      </select>
    </label>
    {kind !== "inherit" && <label className="block text-sm">დანამატი ({kind === "percent" ? "%" : "₾"})
      <input name="amount" required inputMode="decimal" defaultValue={rule ? rule.amount / 100 : ""} className={field} />
    </label>}
  </div>;
}

const labels = { name: "სათაური", subtitle: "ქვესათაური", description: "აღწერა", features: "ძირითადი მახასიათებლები" };
type Copy = Pick<Product, keyof typeof labels>;
const entries = Object.keys(labels) as (keyof Copy)[];
const display = (v: string | string[] | null | undefined) => Array.isArray(v) ? v.join("\n") : v ?? "";

function CopyField({ name, source, published, edits }: { name: keyof Copy; source: Copy; published: Copy; edits: ProductEdits }) {
  const [custom, setCustom] = useState(name in edits);
  return <fieldset className="space-y-2 border-b border-line pb-4">
    <legend className="mb-1 font-semibold">{labels[name]}</legend>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name={"override-" + name}
      checked={custom} onChange={e => setCustom(e.target.checked)} />მაღაზიის საკუთარი ტექსტი</label>
    {custom && <textarea name={name} aria-label={labels[name]} rows={name === "description" ? 7 : name === "features" ? 3 : 2}
      required={name === "name"} className={field} defaultValue={display(name in edits ? edits[name] : source[name])} />}
    {custom && name === "features" && <p className="text-sm text-ink-2">თითო მახასიათებელი ცალკე ხაზზე.</p>}
    <details open={!custom}><summary className="cursor-pointer text-sm text-ink-2">წყაროს ტექსტი</summary>
      <p className="mt-1 whitespace-pre-line text-sm">{display(source[name]) || "—"}</p></details>
    <details><summary className="cursor-pointer text-sm text-ink-2">გამოქვეყნებული ტექსტი</summary>
      <p className="mt-1 whitespace-pre-line text-sm">{display(published[name]) || "—"}</p></details>
  </fieldset>;
}

export function EditForm({ id, token, source, published, edits }: {
  id: string; token: string; source: Copy; published: Copy; edits: ProductEdits;
}) {
  const [error, action, pending] = useActionState(saveDraftAction, null);
  return <form action={action} className="space-y-5 rounded-card border border-line bg-surface p-5">
    <input type="hidden" name="id" value={id}/><input type="hidden" name="token" value={token}/>
    {entries.map(name => <CopyField key={name} name={name} source={source} published={published} edits={edits} />)}
    <RuleFields rule={edits.rule} inheritLabel="მაღაზიის საერთო წესით" />
    {error && <p role="alert" className="text-warn">{error}</p>}
    <div className="flex flex-wrap gap-2">
      <button disabled={pending} className={button}>მონახაზის შენახვა</button>
      <button disabled={pending} name="intent" value="preview" className={primary}>შენახვა და წინასწარი ნახვა</button>
    </div>
  </form>;
}
