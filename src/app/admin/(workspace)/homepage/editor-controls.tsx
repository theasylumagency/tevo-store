"use client";

import Image from "next/image";
import { useId, useState } from "react";
import type { Product } from "@/lib/catalog/types";
import type { HomeTarget } from "@/lib/homepage/model";
import { formatPrice } from "@/lib/format";
import { button, field } from "../catalog/styles";

export type Option = { value: string; label: string };
export type PhotoUpload = (file: File, onUploaded: (path: string) => void) => void;
export const caption = "block space-y-1.5 text-sm font-medium";
export const panel = "space-y-4 rounded-card border border-line bg-surface p-4 sm:p-5";
export const stockNames: Record<Product["availability"]["status"], string> = {
  in_stock: "ხელმისაწვდომია", low_stock: "მარაგი შეზღუდულია", out_of_stock: "ამოწურულია",
  confirm_with_store: "ხელმისაწვდომობა დასაზუსტებელია",
};

export function TextField({ label, value, onChange, long = false, maxLength = long ? 350 : 100 }: {
  label: string; value: string; onChange: (v: string) => void; long?: boolean; maxLength?: number;
}) {
  return <label className={caption}><span>{label}</span>{long
    ? <textarea className={field} value={value} rows={3} maxLength={maxLength} onChange={e => onChange(e.target.value)}/>
    : <input className={field} value={value} maxLength={maxLength} onChange={e => onChange(e.target.value)}/>}
    <span className="block text-right text-xs font-normal text-ink-2">{value.length}/{maxLength}</span>
  </label>;
}

export function Choice({ label, value, options, empty, onChange }: {
  label: string; value: string; options: Option[]; empty?: string; onChange: (v: string) => void;
}) {
  return <label className={caption}><span>{label}</span><select className={field} value={value} onChange={e => onChange(e.target.value)}>
    {empty !== undefined && <option value="">{empty}</option>}
    {value && !options.some(o => o.value === value) && <option value={value}>{value} · მიუწვდომელია</option>}
    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;
}

export function ProductSummary({ product, photos }: { product: Product; photos: Set<string> }) {
  const image = product.media.find(m => m.role === "main") ?? product.media[0];
  const price = product.price.promo ?? product.price.base;
  return <>
    <span className="relative block h-14 w-14 shrink-0 overflow-hidden rounded border border-line bg-white">
      {image && photos.has(image.file) ? <Image fill sizes="56px" src={"/media/" + image.file} alt="" className="object-contain"/>
        : <span className="flex h-full items-center justify-center text-[10px] text-ink-2">ფოტო</span>}
    </span>
    <span className="min-w-0 flex-1"><span className="block text-sm font-medium leading-snug">{product.name}</span>
      <span className="mt-1 block text-xs text-ink-2">{product.id} · {price !== null ? formatPrice(price) : "ფასი დასაზუსტებელია"}</span>
      <span className="mt-1 block text-xs text-ink-2">{stockNames[product.availability.status]}</span>
    </span>
  </>;
}

export function ProductPicker({ label, value, products, photos, exclude = [], onChange, allowAutomatic = false }: {
  label: string; value?: string; products: Product[]; photos: Set<string>; exclude?: string[];
  onChange: (id: string) => void; allowAutomatic?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(!value && !allowAutomatic);
  const id = useId();
  const product = products.find(p => p.id === value);
  const words = query.trim().toLocaleLowerCase("ka").split(/\s+/).filter(Boolean);
  const matches = products.filter(p => !exclude.includes(p.id) && words.every(word =>
    [p.name, p.id, p.model, p.codes.supplier, p.codes.ean].filter(Boolean).join(" ").toLocaleLowerCase("ka").includes(word)));
  return <div className="space-y-2">
    <p className="text-sm font-medium">{label}</p>
    {product && <div className="flex items-center gap-3 rounded-card border border-line p-3"><ProductSummary product={product} photos={photos}/></div>}
    {value && !product && <p className="text-sm text-warn">{value} · პროდუქტი აღარ არის გამოქვეყნებული</p>}
    {allowAutomatic && !value && <p className="text-sm text-ink-2">ავტომატურად · მოქმედი აქციიდან</p>}
    <div className="flex flex-wrap gap-2"><button type="button" className={button} aria-expanded={open} aria-controls={id} onClick={() => setOpen(v => !v)}>
      {open ? "ძიების დახურვა" : value ? "პროდუქტის შეცვლა" : "პროდუქტის მოძებნა"}</button>
      {allowAutomatic && value && <button type="button" className={button} onClick={() => onChange("")}>ავტომატური არჩევა</button>}
    </div>
    {open && <div id={id} className="space-y-2 rounded-card border border-line p-3">
      <label className={caption}><span>ძებნა · {label}</span><input className={field} value={query}
        placeholder="სახელი, კოდი ან მოდელი" onChange={e => setQuery(e.target.value)}/></label>
      <p className="text-xs text-ink-2">ნაპოვნია {matches.length} პროდუქტი{matches.length > 12 ? " · დააზუსტე ძიება" : ""}</p>
      <ul className="max-h-80 space-y-1 overflow-y-auto">{matches.slice(0, 12).map(p => <li key={p.id}>
        <button type="button" className="flex w-full items-center gap-3 rounded-card p-2 text-left hover:bg-accent-soft"
          onClick={() => { onChange(p.id); setQuery(""); setOpen(false); }}>
          <ProductSummary product={p} photos={photos}/><span className="shrink-0 text-sm text-accent">არჩევა</span>
        </button></li>)}</ul>
      {!matches.length && <p className="text-sm text-ink-2">ამ ძიებით პროდუქტი ვერ მოიძებნა.</p>}
    </div>}
  </div>;
}

export function TargetFields({ value, types, categories, products, photos, onChange }: {
  value: HomeTarget; types: Option[]; categories: Option[]; products: Product[]; photos: Set<string>;
  onChange: (next: HomeTarget) => void;
}) {
  return <div className="space-y-3">
    <Choice label="ღილაკის დანიშნულება" value={value.kind} options={[
      { value: "none", label: "ღილაკის გარეშე" }, { value: "catalog", label: "მთლიანი კატალოგი" },
      { value: "category", label: "კატეგორია" }, { value: "type", label: "პროდუქტის ტიპი" }, { value: "product", label: "კონკრეტული პროდუქტი" },
    ]} onChange={kind => onChange({ ...value, kind: kind as HomeTarget["kind"], value: "" })}/>
    {value.kind !== "none" && <TextField label="ღილაკის ტექსტი" value={value.label} maxLength={80} onChange={label => onChange({ ...value, label })}/>}
    {value.kind === "category" && <Choice label="სამიზნე კატეგორია" value={value.value} empty="აირჩიე კატეგორია" options={categories} onChange={target => onChange({ ...value, value: target })}/>}
    {value.kind === "type" && <Choice label="სამიზნე პროდუქტის ტიპი" value={value.value} empty="აირჩიე ტიპი" options={types} onChange={target => onChange({ ...value, value: target })}/>}
    {value.kind === "product" && <ProductPicker label="სამიზნე პროდუქტი" value={value.value} products={products} photos={photos} onChange={target => onChange({ ...value, value: target })}/>}
  </div>;
}

function PhotoField({ label, value, photos, onChange, uploading, onUpload }: {
  label: string; value: string; photos: Option[]; onChange: (file: string) => void;
  uploading: boolean; onUpload: PhotoUpload;
}) {
  return <fieldset className="min-w-0 space-y-2" disabled={uploading}>
    <Choice label={label} value={value} options={photos} empty="ნაგულისხმევი" onChange={onChange}/>
    <label className={caption}><span>{label} · ატვირთვა</span>
      <input type="file" accept="image/jpeg,image/png,image/webp,image/avif"
        className="block w-full text-sm file:mr-3 file:rounded file:border file:border-line file:bg-bg file:px-3 file:py-2"
        onChange={e => {
          const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
          onUpload(file, onChange);
        }}/>
    </label>
    <p className="text-xs text-ink-2">JPG, PNG, WebP ან AVIF · მაქსიმუმ 8 მბ</p>
  </fieldset>;
}

export function PhotoSettings({ value, photos, onChange, uploading, onUpload }: {
  value: { photo: string; mobilePhoto: string; focalX: number; focalY: number };
  photos: Option[]; onChange: (next: Partial<typeof value>) => void; uploading: boolean; onUpload: PhotoUpload;
}) {
  return <div className="space-y-3">
    <PhotoField label="ფოტო მედიათეკიდან" value={value.photo} photos={photos} uploading={uploading} onUpload={onUpload} onChange={photo => onChange({ photo })}/>
    {value.photo && photos.some(p => p.value === value.photo) && <div className="relative aspect-[16/10] max-w-sm overflow-hidden rounded-card border border-line bg-white">
      <Image fill sizes="360px" src={"/media/" + value.photo} alt="არჩეული ფოტო" className="object-contain"
        style={{ objectPosition: `${value.focalX}% ${value.focalY}%` }}/></div>}
    <details className="rounded-card border border-line p-3"><summary className="cursor-pointer text-sm font-medium">ფოტოს მორგება მობილურზე</summary>
      <div className="mt-4 space-y-4"><PhotoField label="მობილურის ცალკე ფოტო" value={value.mobilePhoto} photos={photos} uploading={uploading} onUpload={onUpload} onChange={mobilePhoto => onChange({ mobilePhoto })}/>
        <p className="text-xs text-ink-2">ცალკე ფოტოს გარეშე გამოიყენება მთავარი ფოტო. მონიშნე მნიშვნელოვანი ადგილის მდებარეობა.</p>
        <label className={caption}><span>ჰორიზონტალური მდებარეობა · {value.focalX}%</span><input className="w-full" type="range" min="0" max="100" value={value.focalX} onChange={e => onChange({ focalX: Number(e.target.value) })}/></label>
        <label className={caption}><span>ვერტიკალური მდებარეობა · {value.focalY}%</span><input className="w-full" type="range" min="0" max="100" value={value.focalY} onChange={e => onChange({ focalY: Number(e.target.value) })}/></label>
      </div>
    </details>
  </div>;
}
