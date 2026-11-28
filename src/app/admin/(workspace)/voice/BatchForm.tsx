"use client";

import { useState } from "react";
import { startVoiceAction } from "@/app/actions/voice";
import { presets, type VoiceProfile } from "@/lib/voice/model";
import { primary, field, button } from "../catalog/styles";

type Product = { id: string; name: string; blocked: string };
export function BatchForm({ products, suggested, run, basis, version, initial, enabled, canNotify }: {
  products: Product[]; suggested: string[]; run: string; basis: string | null; version: number; initial: VoiceProfile;
  enabled: boolean; canNotify: boolean;
}) {
  const [profile, setProfile] = useState(initial);
  const [selected, setSelected] = useState(suggested);
  return <form action={startVoiceAction} className="space-y-4 rounded-card border border-line bg-surface p-5">
    <h2 className="text-lg font-semibold">ხმის არჩევა და გამოცდა</h2>
    <input type="hidden" name="run" value={run}/><input type="hidden" name="scope" value="audition"/>
    <input type="hidden" name="revision" value={version}/><input type="hidden" name="basis" value={basis ?? ""}/>
    <label className="block text-sm"><span className="font-medium">ვისთვის ვწერთ</span>
      <span className="block text-ink-2">მაღაზიის მყიდველი და აღწერის დანიშნულება. ერთია ყველა ხმისთვის; ფაქტების შერჩევასა და ენას განსაზღვრავს, ახალ ფაქტს არა.</span>
      <textarea name="audience" maxLength={1500} rows={3} className={field} value={profile.audience ?? ""}
        onChange={e => setProfile({ ...profile, audience: e.target.value })}/></label>
    <div className="grid gap-3 md:grid-cols-3">{presets.map(p => <button type="button" key={p.name}
      aria-pressed={p.profile.tone === profile.tone}
      className={button + " text-left aria-pressed:border-accent aria-pressed:bg-subtle"}
      onClick={() => setProfile({ ...p.profile, audience: profile.audience })}>
      <strong>{p.name}</strong><span className="mt-2 block font-normal text-ink-2">{p.summary}</span></button>)}</div>
    <details><summary className="cursor-pointer text-accent">ხმის ტექსტის ჩასწორება</summary>
      <div className="mt-2 space-y-2">{([["tone", "როგორ ვწერთ"], ["avoid", "რას ვერიდებით"], ["example", "სასურველი ტექსტის მაგალითი"]] as const).map(([key, label]) =>
        <label key={key} className="block text-sm">{label}<textarea name={key} maxLength={1500} rows={2} className={field}
          value={profile[key]} onChange={e => setProfile({ ...profile, [key]: e.target.value })}/></label>)}</div></details>
    <fieldset className="grid gap-2 md:grid-cols-3"><legend className="mb-2 font-medium">სამი საცდელი პროდუქტი</legend>
      <p className="text-sm text-ink-2 md:col-span-3">ორი მსგავსი მოდელით შეაფასებ, რამდენად ნათლად ჩანს განსხვავება. მესამე ნიმუშით შეგიძლია იგივე ხმა სხვა ტიპის პროდუქტზეც გამოცადო.</p>
      {Array.from({ length: 3 }, (_, i) => <select className={field + " min-w-0"} key={i} name="product" aria-label={"საცდელი პროდუქტი " + (i + 1)}
        value={selected[i] ?? ""} onChange={e => { const ids = [...selected]; ids[i] = e.target.value; setSelected(ids); }}>
        <option disabled value="">აირჩიე პროდუქტი</option>
        {products.filter(p => !p.blocked).map(p => <option key={p.id} value={p.id} disabled={selected.includes(p.id) && selected[i] !== p.id}>{p.name} · {p.id}</option>)}
      </select>)}</fieldset>
    {canNotify && <label className="block text-sm"><input type="checkbox" name="notify"/> დასრულებისას ეცნობოს მაღაზიის თანამშრომლებს ელფოსტით</label>}
    <button className={primary} disabled={!enabled || !profile.tone.trim() || selected.filter(Boolean).length !== 3}>მოამზადე 3 საცდელი აღწერა</button>
  </form>;
}
