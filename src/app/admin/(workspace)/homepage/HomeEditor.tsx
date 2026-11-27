"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { saveHomeAction } from "@/app/actions/homepage";
import { blockNames, blocks, presetNames, presets, type Block, type HomeDocument } from "@/lib/homepage/model";
import { button, field, primary } from "../catalog/styles";

type Option = { value: string; label: string };
type Props = { draft: HomeDocument; revision: number; products: Option[]; types: Option[]; photos: Option[] };
const panel = "space-y-4 rounded-card border border-line bg-surface p-4 sm:p-5";
const caption = "block space-y-1 text-sm font-medium";
const summaries = { catalog: "კატეგორიები და პროდუქტის ტიპები", offer: "ერთი მთავარი შეთავაზება", guide: "პროდუქტის პოვნა სამუშაოს მიხედვით" };

function TextField({ label, value, onChange, long = false }: {
  label: string; value: string; onChange: (v: string) => void; long?: boolean;
}) {
  return <label className={caption}>{label}{long
    ? <textarea className={field} value={value} rows={2} maxLength={350} onChange={e => onChange(e.target.value)}/>
    : <input className={field} value={value} required maxLength={100} onChange={e => onChange(e.target.value)}/>}</label>;
}
function Choice({ label, value, options, empty, onChange }: {
  label: string; value: string; options: Option[]; empty?: string; onChange: (v: string) => void;
}) {
  return <label className={caption}>{label}<select className={field} value={value} onChange={e => onChange(e.target.value)}>
    {empty !== undefined && <option value="">{empty}</option>}
    {value && !options.some(o => o.value === value) && <option value={value}>{value} · მიუწვდომელია</option>}
    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;
}
function PhotoChoice({ value, photos, onChange }: { value: string; photos: Option[]; onChange: (v: string) => void }) {
  return <div className="space-y-2"><Choice label="ფოტო მედიათეკიდან" value={value} options={photos} empty="ნაგულისხმევი" onChange={onChange}/>
    {value && photos.some(p => p.value === value) && <Image width={140} height={90} src={"/media/" + value} alt="არჩეული ფოტო" className="h-20 w-32 rounded-card bg-white object-contain"/>}</div>;
}
function move<T>(items: T[], index: number, step: number) {
  const copy = [...items];
  [copy[index], copy[index + step]] = [copy[index + step], copy[index]];
  return copy;
}
export function HomeEditor({ draft, revision, products, types, photos }: Props) {
  const [doc, setDoc] = useState(draft);
  const [section, setSection] = useState<Block | "intro">("intro");
  const [error, action, pending] = useActionState(saveHomeAction, null);
  const layout = doc.layouts[doc.preset];
  function update<K extends keyof HomeDocument>(key: K, value: HomeDocument[K]) {
    setDoc(prev => ({ ...prev, [key]: value }));
  }
  function arrange(next: Block[]) { update("layouts", { ...doc.layouts, [doc.preset]: next }); }
  const { intro, offer, picks, guide } = doc;
  return <form action={action} className="space-y-5">
    <input type="hidden" name="revision" value={revision}/><input type="hidden" name="document" value={JSON.stringify(doc)}/>
    <fieldset className={panel}><legend className="px-1 font-semibold">განლაგება</legend>
      <div className="grid gap-2 md:grid-cols-3">{presets.map(p => <label key={p}
        className={"cursor-pointer rounded-card border p-3 " + (doc.preset === p ? "border-accent bg-accent-soft" : "border-line")}>
        <span className="flex items-center gap-2 font-semibold"><input type="radio" name="preset" value={p} checked={doc.preset === p}
          onChange={() => update("preset", p)}/>{presetNames[p]}</span><span className="mt-2 block text-sm text-ink-2">{summaries[p]}</span>
      </label>)}</div>
    </fieldset>
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(15rem,1fr)_minmax(0,1.8fr)]">
      <section className={panel}><h2 className="font-semibold">ბლოკები</h2>
        <button type="button" aria-pressed={section === "intro"} onClick={() => setSection("intro")} className={button}>შესავალი</button>
        <ul className="divide-y divide-line">{[...layout, ...blocks.filter(k => !layout.includes(k))].map(key => {
          const index = layout.indexOf(key);
          return <li key={key} className="flex flex-wrap items-center gap-1 py-2">
            <input type="checkbox" aria-label={blockNames[key] + " · ჩართვა"} checked={index >= 0} disabled={key === doc.preset || key === "catalog"}
              onChange={() => arrange(index < 0 ? [...layout, key] : layout.filter(k => k !== key))}/>
            <button type="button" aria-pressed={section === key} onClick={() => setSection(key)} className={"mr-auto p-1 text-left text-sm " + (section === key ? "font-bold text-accent" : "")}>{blockNames[key]}</button>
            {index > 0 && <><button type="button" disabled={index === 1} aria-label={blockNames[key] + " ზემოთ"} className="p-2 disabled:opacity-30" onClick={() => arrange(move(layout, index, -1))}>↑</button>
              <button type="button" disabled={index === layout.length - 1} aria-label={blockNames[key] + " ქვემოთ"} className="p-2 disabled:opacity-30" onClick={() => arrange(move(layout, index, 1))}>↓</button></>}
          </li>;
        })}</ul>
        <p className="text-sm text-ink-2">პირველი ბლოკი განლაგებით განისაზღვრება. კატეგორიები სამივე განლაგებაში ჩანს.</p>
      </section>
      <section className={panel} aria-label="ბლოკის შინაარსი"><h2 className="font-semibold">{section === "intro" ? "შესავალი" : blockNames[section]}</h2>
        {section === "intro" && <>
          <TextField label="მთავარი სათაური" value={intro.title} onChange={title => update("intro", { ...intro, title })}/>
          <TextField long label="შესავლის ტექსტი" value={intro.text} onChange={text => update("intro", { ...intro, text })}/>
          <PhotoChoice value={intro.photo} photos={photos} onChange={photo => update("intro", { ...intro, photo })}/>
          {doc.preset === "offer" && <p className="text-sm text-ink-2">აქტიური შეთავაზებისას შესავლის ადგილს შეთავაზება იკავებს.</p>}
        </>}
        {section === "catalog" && <TextField label="სექციის სათაური" value={doc.catalogTitle} onChange={v => update("catalogTitle", v)}/>}
        {section === "popular" && <><TextField label="სექციის სათაური" value={doc.popularTitle} onChange={v => update("popularTitle", v)}/>
          <p className="text-sm text-ink-2">ითვლება ბოლო 30 დღეში დადასტურებული გაყიდვების რაოდენობა. გაუქმებული და თანხის დაბრუნებით დასრულებული შეკვეთები გამორიცხულია. გაყიდვების გარეშე გამოჩნდება „ჩვენი შერჩევა“.</p></>}
        {section === "offer" && <>
          <TextField label="შეთავაზების სათაური" value={offer.title} onChange={title => update("offer", { ...offer, title })}/>
          <Choice label="პროდუქტი" empty="ავტომატურად · მოქმედი აქციიდან" value={offer.product} options={products} onChange={product => update("offer", { ...offer, product })}/>
          <TextField label="მოკლე ტექსტი" long value={offer.text} onChange={text => update("offer", { ...offer, text })}/>
          <PhotoChoice value={offer.photo} photos={photos} onChange={photo => update("offer", { ...offer, photo })}/>
          <div className="grid gap-2 sm:grid-cols-2">{(["start", "end"] as const).map(key => <label key={key} className={caption}>
            {key === "start" ? "დაწყება" : "დასრულება"} · თბილისი<input className={field} type="datetime-local" value={offer[key]}
              onChange={e => update("offer", { ...offer, [key]: e.target.value })}/></label>)}</div>
          <Choice label="თუ შეთავაზება მიუწვდომელია" options={[{ value: "hide", label: "ბლოკის დამალვა" }, { value: "picks", label: "ჩვენი შერჩევით ჩანაცვლება" }]}
            value={offer.fallback} onChange={v => update("offer", { ...offer, fallback: v === "hide" ? "hide" : "picks" })}/>
          <p className="text-sm text-ink-2">გამოჩნდება მხოლოდ მაღაზიაში გამოქვეყნებული აქციის ფასი. ცარიელი თარიღები პერიოდს არ ზღუდავს.</p>
        </>}
        {section === "picks" && <>
          <TextField label="სექციის სათაური" value={picks.title} onChange={title => update("picks", { ...picks, title })}/>
          <TextField label="მოკლე ტექსტი" long value={picks.text} onChange={text => update("picks", { ...picks, text })}/>
          <Choice label="შერჩევის წესი" value={picks.mode} options={[{ value: "type", label: "პროდუქტის ტიპით" }, { value: "manual", label: "ხელით შერჩევა" }]}
            onChange={v => update("picks", { ...picks, mode: v === "manual" ? "manual" : "type" })}/>
          {picks.mode === "type" ? <Choice label="პროდუქტის ტიპი" options={types} value={picks.type} onChange={type => update("picks", { ...picks, type })}/> :
            <><ol className="space-y-2">{picks.ids.map((id, i) => <li key={id} className="flex items-center gap-2 text-sm">
              <span className="mr-auto">{products.find(p => p.value === id)?.label ?? id}</span>
              <button type="button" disabled={!i} aria-label="პროდუქტი ზემოთ" className="p-2 disabled:opacity-30" onClick={() => update("picks", { ...picks, ids: move(picks.ids, i, -1) })}>↑</button>
              <button type="button" onClick={() => update("picks", { ...picks, ids: picks.ids.filter(p => p !== id) })}>ამოღება</button>
            </li>)}</ol>{picks.ids.length < 8 && <Choice label="პროდუქტის დამატება" value="" empty="აირჩიე პროდუქტი"
              options={products.filter(p => !picks.ids.includes(p.value))} onChange={id => { if (id) update("picks", { ...picks, ids: [...picks.ids, id] }); }}/>}</>}
        </>}
        {section === "guide" && <>
          <TextField label="სექციის სათაური" value={guide.title} onChange={title => update("guide", { ...guide, title })}/>
          {guide.tasks.map((task, i) => {
            const patch = (data: Partial<typeof task>) => update("guide", { ...guide, tasks: guide.tasks.map((v, j) => i === j ? { ...v, ...data } : v) });
            return <fieldset key={i} className="space-y-3 border-t border-line pt-3"><legend className="font-medium">ამოცანა {i + 1}</legend>
              <TextField label="ამოცანის სახელწოდება" value={task.title} onChange={title => patch({ title })}/>
              <TextField long label="განმარტება" value={task.text} onChange={text => patch({ text })}/>
              <Choice label="შესაბამისი პროდუქტები" value={task.type} options={types} onChange={type => patch({ type })}/>
              <button type="button" className={button} onClick={() => update("guide", { ...guide, tasks: guide.tasks.filter((_, j) => i !== j) })}>ამოცანის ამოღება</button>
            </fieldset>;
          })}
          {guide.tasks.length < 6 && types.length > 0 && <button type="button" className={button} onClick={() => update("guide",
            { ...guide, tasks: [...guide.tasks, { title: "", text: "", type: types[0].value }] })}>ამოცანის დამატება</button>}
        </>}
      </section>
    </div>
    {error && <p role="alert" className="text-warn">{error}</p>}
    <div className="flex flex-wrap gap-2"><button className={button} disabled={pending}>მონახაზის შენახვა</button>
      <button name="intent" value="preview" className={primary} disabled={pending}>შენახვა და წინასწარი ნახვა</button></div>
  </form>;
}
