"use client";

import { useState } from "react";
import { startVoiceAction } from "@/app/actions/voice";
import { chooseProducts, scopes, type Scope } from "@/lib/voice/model";
import { field, primary } from "../catalog/styles";

type Product = { id: string; name: string; blocked: string; fresh: boolean; changed: boolean };
export function BatchForm({ products, run, version, enabled }: { products: Product[]; run: string; version: number; enabled: boolean }) {
  const [scope, setScope] = useState<Scope>("pilot");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const eligible = products.filter(p => !p.blocked);
  const chosen = chooseProducts(products, scope, selected);
  const count = chosen.length;
  const matching = products.filter(p => (p.name + " " + p.id).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <form action={startVoiceAction} className="space-y-4 rounded-card border border-line bg-surface p-5">
    <h2 className="text-lg font-semibold">ახალი ჯგუფი</h2>
    <input type="hidden" name="run" value={run}/><input type="hidden" name="revision" value={version}/>
    <label className="block text-sm">პროდუქტები<select className={field} name="scope" value={scope} onChange={e => setScope(e.target.value as Scope)}>
      {Object.entries(scopes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    {chosen.map(p => <input key={p.id} type="hidden" name="product" value={p.id}/>)}
    {scope === "selected" && <div className="space-y-2">
      <input className={field} aria-label="პროდუქტის ძიება" placeholder="სახელი ან SKU" value={query} onChange={e => setQuery(e.target.value)}/>
      <ul className="max-h-64 divide-y divide-line overflow-auto rounded-card border border-line">{matching.map(p =>
        <li key={p.id}><label className="flex items-start gap-2 p-2 text-sm">
          <input type="checkbox" disabled={!!p.blocked} checked={selected.includes(p.id)} onChange={e => setSelected(e.target.checked ? [...selected, p.id] : selected.filter(id => id !== p.id))}/>
          <span>{p.name}<small className="block text-ink-2">{p.id}{p.blocked && " · " + p.blocked}</small></span>
        </label></li>)}</ul>
    </div>}
    {products.length > eligible.length && <details className="text-sm"><summary>გამოტოვებული პროდუქტები · {products.length - eligible.length}</summary>
      <ul className="max-h-40 overflow-auto">{products.filter(p => p.blocked).map(p => <li key={p.id}>{p.name} · {p.blocked}</li>)}</ul></details>}
    <button className={primary} disabled={!enabled || !count}>აღწერების მომზადება · {count}</button>
    <p className="text-sm text-ink-2">თითო პროდუქტზე იგზავნება ერთი ფასიანი მოთხოვნა. მომზადებული ტექსტები განხილვის ჯგუფში შეინახება. იმავე პროდუქტების ხელახლა შერჩევისას წინა AI ვარიანტიც ხელმისაწვდომია შედარებისთვის; არაფერი ქვეყნდება ავტომატურად.</p>
  </form>;
}
