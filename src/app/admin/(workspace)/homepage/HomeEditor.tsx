"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { releaseHomeAction, saveHomeDraftAction, uploadHomePhotoAction } from "@/app/actions/homepage";
import type { Catalog, Product } from "@/lib/catalog/types";
import {
  blockNames, blocks, collectionSortNames, localTime, normalizeHome, presetNames, presetSummaries, presets, serviceNames,
  type Block, type HomeCollection, type HomeDocument, type HomeSchedule, type ServiceItem,
} from "@/lib/homepage/model";
import { assessHome, summarizeHomeChanges } from "@/lib/homepage/policy";
import { selectCollection } from "@/lib/homepage/selection";
import { button, primary } from "../catalog/styles";
import { Choice, PhotoSettings, ProductPicker, ProductSummary, TargetFields, TextField, panel, type Option } from "./editor-controls";
import { clearHomeRecovery, readHomeRecovery, writeHomeRecovery, type HomeRecovery } from "./draft-recovery";

type Props = {
  draft: HomeDocument; published: HomeDocument; revision: number; updatedAt: string | null;
  catalog: Catalog; photos: Option[]; sales: string[]; schedule: HomeSchedule | null; now: number;
  suggestedProductId?: string;
};
type SaveState = "saved" | "dirty" | "saving" | "error" | "conflict";
const descriptions: Record<Block | "intro", string> = {
  intro: "მაღაზიის მთავარი გზავნილი, ფოტო და გადასასვლელი.",
  catalog: "გამოყავი კატეგორიები და დაალაგე პრიორიტეტით. სრული კატალოგი ხელმისაწვდომი რჩება.",
  offer: "ერთი შეთავაზება მაღაზიაში მოქმედი აქციის ფასით.",
  picks: "შეარჩიე პროდუქტები ხელით ან გასაგები წესით.",
  seasonal: "ცალკე შერჩევა სეზონისა თუ კონკრეტული სამუშაოსთვის.",
  guide: "დაეხმარე ვიზიტორს გასაკეთებელი საქმის მიხედვით დაიწყოს არჩევა.",
  popular: "ბოლო 30 დღის რეალურ გაყიდვებზე დაფუძნებული შერჩევა.",
  advice: "მოკლე რჩევა და პირდაპირი გზა შესაბამის პროდუქტებამდე.",
  service: "მაღაზიის საერთო პირობები და საკონტაქტო ინფორმაცია.",
};
const date = (value: string | null) => value ? new Intl.DateTimeFormat("ka-GE", {
  timeZone: "Asia/Tbilisi", hour: "2-digit", minute: "2-digit", second: "2-digit",
}).format(new Date(value)) : "";
function move<T>(items: T[], index: number, step: number) {
  const copy = [...items];
  if (index + step < 0 || index + step >= copy.length) return copy;
  [copy[index], copy[index + step]] = [copy[index + step], copy[index]];
  return copy;
}

function LayoutSample({ preset }: { preset: HomeDocument["preset"] }) {
  return <div aria-hidden="true" className="my-3 grid h-20 gap-1 rounded border border-line bg-bg p-2">
    {preset === "offer" && <span className="rounded bg-accent/20"/>}
    {preset === "guide" && <span className="grid grid-cols-3 gap-1">{[0, 1, 2].map(n => <span key={n} className="rounded bg-accent/20"/>)}</span>}
    <span className="grid grid-cols-4 gap-1">{[0, 1, 2, 3].map(n => <span key={n} className="rounded bg-line"/>)}</span>
    <span className="grid grid-cols-4 gap-1">{[0, 1, 2, 3].map(n => <span key={n} className="rounded border border-line"/>)}</span>
  </div>;
}

function CollectionFields({ collectionKey, collection, products, allProducts, types, photoSet, onChange, onAdd }: {
  collectionKey: "picks" | "seasonal"; collection: HomeCollection; products: Product[]; allProducts: Product[];
  types: Option[]; photoSet: Set<string>; onChange: (value: Partial<HomeCollection>) => void; onAdd: (id: string) => void;
}) {
    const selected = selectCollection(collection, allProducts);
    const shown = new Set(selected.map(p => p.id));
    return <>
      <TextField label="სექციის სათაური" value={collection.title} onChange={title => onChange({ title })}/>
      <TextField label="მოკლე ტექსტი" long value={collection.text} onChange={text => onChange({ text })}/>
      <Choice label="შერჩევის წესი" value={collection.mode} options={[{ value: "manual", label: "თავად შევარჩიო" }, { value: "type", label: "პირობით შეირჩეს" }]}
        onChange={mode => onChange({ mode: mode === "manual" ? "manual" : "type" })}/>
      {collection.mode === "type" ? <div className="grid gap-3 sm:grid-cols-2">
        <Choice label="პროდუქტის ტიპი" value={collection.type} options={types} empty="აირჩიე ტიპი" onChange={type => onChange({ type })}/>
        <Choice label="დალაგება" value={collection.sort} options={Object.entries(collectionSortNames).map(([value, label]) => ({ value, label }))}
          onChange={sort => onChange({ sort: sort as HomeCollection["sort"] })}/>
      </div> : <>
        <ol className="space-y-2">{collection.ids.map((id, index) => {
          const product = products.find(p => p.id === id);
          return <li key={id} className="rounded-card border border-line p-3">
            <div className="flex items-center gap-3">{product ? <ProductSummary product={product} photos={photoSet}/>
              : <span className="text-sm">{id} · აღარ არის გამოქვეყნებული</span>}</div>
            {!shown.has(id) && <p className="mt-2 text-xs text-warn">ამჟამად არ გამოჩნდება · შეამოწმე ფასი, ხელმისაწვდომობა და არჩეული პირობები.</p>}
            <div className="mt-2 flex flex-wrap gap-2"><button type="button" className={button} disabled={!index} aria-label="პროდუქტი ზემოთ"
              onClick={() => onChange({ ids: move(collection.ids, index, -1) })}>↑ ზემოთ</button>
              <button type="button" className={button} disabled={index === collection.ids.length - 1} aria-label="პროდუქტი ქვემოთ"
                onClick={() => onChange({ ids: move(collection.ids, index, 1) })}>↓ ქვემოთ</button>
              <button type="button" className={button} onClick={() => onChange({ ids: collection.ids.filter(value => value !== id) })}>ამოღება</button>
            </div>
          </li>;
        })}</ol>
        {collection.ids.length < 8 && <ProductPicker label="პროდუქტის დამატება" products={products} photos={photoSet} exclude={collection.ids}
          onChange={onAdd}/>}
      </>}
      <details className="rounded-card border border-line p-3"><summary className="cursor-pointer text-sm font-medium">შერჩევის დამატებითი პირობები</summary>
        <div className="mt-3 space-y-3"><Choice label="საჩვენებელი პროდუქტების რაოდენობა" value={String(collection.limit)}
          options={[{ value: "4", label: "4 პროდუქტი" }, { value: "8", label: "8 პროდუქტი" }]} onChange={limit => onChange({ limit: Number(limit) as 4 | 8 })}/>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={collection.onlyInStock}
            onChange={e => onChange({ onlyInStock: e.target.checked })}/><span>მხოლოდ დადასტურებულად ხელმისაწვდომი პროდუქტები
              <span className="mt-1 block text-xs text-ink-2">გამოირიცხება პროდუქტები, რომელთა ხელმისაწვდომობაც დასაზუსტებელია.</span></span></label>
          {collection.mode === "manual" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={collection.sort === "offers"}
            onChange={e => onChange({ sort: e.target.checked ? "offers" : "recommended" })}/>მხოლოდ მოქმედი აქციის მქონე პროდუქტები</label>}
        </div>
      </details>
      <div className="space-y-3 border-t border-line pt-4" data-testid={collectionKey + "-result"}><h3 className="font-semibold" aria-live="polite">ახლა გამოჩნდება {selected.length} პროდუქტი</h3>
        {!selected.length && <p className="text-sm text-ink-2">ცარიელი შერჩევა საჯარო გვერდზე დაიმალება.</p>}
        <div className="grid gap-2 xl:grid-cols-2">{selected.map(product => <div key={product.id} className="flex items-center gap-2 rounded-card bg-bg p-2"><ProductSummary product={product} photos={photoSet}/></div>)}</div>
        <p className="text-xs text-ink-2">ფასები და ხელმისაწვდომობა მოდის მაღაზიის გამოქვეყნებული კატალოგიდან.</p>
      </div>
    </>;
  }


export function HomeEditor({ draft, published, revision, updatedAt, catalog, photos: initialPhotos, sales, schedule, now, suggestedProductId }: Props) {
  const router = useRouter();
  const [doc, setDoc] = useState(() => normalizeHome(draft));
  const latest = useRef(doc);
  const saved = useRef(JSON.stringify(doc));
  const revisionRef = useRef(revision);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const uploadInFlight = useRef<Promise<boolean> | null>(null);
  const uploadFailed = useRef(false);
  const active = useRef(false);
  const recoveryOwner = useRef("");
  const pendingRecovery = useRef<HomeRecovery | null>(null);
  const conflicted = useRef(false);
  const [currentRevision, setCurrentRevision] = useState(revision);
  const [state, setState] = useState<SaveState>("saved");
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState(updatedAt);
  const [section, setSection] = useState<Block | "intro">("intro");
  const [photos, setPhotos] = useState(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [recovery, setRecovery] = useState<HomeRecovery | null>(null);
  const [recoveryUnavailable, setRecoveryUnavailable] = useState(false);
  const [busy, startTransition] = useTransition();
  const [, startUploadTransition] = useTransition();
  const products = useMemo(() => catalog.products.filter(p => p.visible), [catalog]);
  const types = useMemo(() => catalog.product_types.filter(t => products.some(p => p.product_type === t.id))
    .map(t => ({ value: t.id, label: t.name_plural })), [catalog, products]);
  const categories = useMemo(() => catalog.categories.filter(c => products.some(p => p.category === c.id))
    .map(c => ({ value: c.id, label: c.name })), [catalog, products]);
  const photoSet = useMemo(() => new Set(photos.map(p => p.value)), [photos]);
  const diagnostics = useMemo(() => assessHome(doc, catalog, { now, media: [...photoSet], sales }), [doc, catalog, now, photoSet, sales]);
  const changes = useMemo(() => summarizeHomeChanges(published, doc), [published, doc]);
  const recoveryChanges = useMemo(() => recovery ? summarizeHomeChanges(doc, recovery.document) : [], [doc, recovery]);
  const layout = doc.layouts[doc.preset];
  const serialized = JSON.stringify(doc);
  const activeSchedule = schedule && (localTime(schedule.start) > now || !schedule.end || localTime(schedule.end) > now);
  const campaign = activeSchedule && schedule && !!schedule.end && localTime(schedule.start) <= now;
  const suggested = products.find(product => product.id === suggestedProductId);

  const remember = useCallback((claim = false) => {
    const stored = readHomeRecovery();
    recoveryOwner.current ||= crypto.randomUUID();
    // A late response from a hidden editor must not replace this tab's newer edits.
    if (stored && stored.owner !== recoveryOwner.current && !claim) return;
    if (saved.current === JSON.stringify(latest.current)) { clearHomeRecovery(recoveryOwner.current); return; }
    const written = writeHomeRecovery({ owner: recoveryOwner.current, revision: revisionRef.current,
      document: latest.current, updatedAt: new Date().toISOString() });
    setRecoveryUnavailable(!written);
  }, []);

  useEffect(() => {
    active.current = true;
    const stored = readHomeRecovery();
    if (stored && stored.owner !== recoveryOwner.current) {
      if (JSON.stringify(stored.document) === saved.current) clearHomeRecovery(stored.owner);
      else {
        pendingRecovery.current = stored;
        startTransition(() => setRecovery(stored));
      }
    }
    return () => { active.current = false; };
  }, []);

  const flush = useCallback((): Promise<boolean> => {
    if (conflicted.current || pendingRecovery.current) return Promise.resolve(false);
    if (inFlight.current) return inFlight.current;
    const persist = async () => {
      for (;;) {
        // A selected image becomes part of the draft before any preview or navigation.
        if (uploadInFlight.current && !(await uploadInFlight.current)) return false;
        if (uploadFailed.current) return false;
        if (saved.current === JSON.stringify(latest.current)) break;
        const snapshot = structuredClone(latest.current);
        const snapshotJson = JSON.stringify(snapshot);
        setState("saving"); setError("");
        try {
          const result = await saveHomeDraftAction({ revision: revisionRef.current, document: snapshot });
          if (result.error || result.revision === undefined) {
            conflicted.current = !!result.conflict;
            setState(result.conflict ? "conflict" : "error");
            setError(result.error ?? "მონახაზის შენახვა ვერ მოხერხდა.");
            return false;
          }
          revisionRef.current = result.revision;
          setCurrentRevision(result.revision);
          saved.current = snapshotJson;
          setSavedAt(result.savedAt ?? null);
          remember();
          // Any edits typed while this request was in flight remain in latest and are saved next.
        } catch {
          setState("error"); setError("მონახაზი ვერ შეინახა. შეამოწმე კავშირი და სცადე ხელახლა.");
          return false;
        }
      }
      setState("saved"); return true;
    };
    inFlight.current = persist().finally(() => { inFlight.current = null; });
    return inFlight.current;
  }, [remember]);

  useEffect(() => {
    if (saved.current === serialized || conflicted.current || pendingRecovery.current) return;
    const timer = setTimeout(() => startTransition(async () => { await flush(); }), 900);
    return () => clearTimeout(timer);
  }, [serialized, flush]);

  useEffect(() => {
    const unsaved = () => saved.current !== JSON.stringify(latest.current) || !!uploadInFlight.current;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (unsaved()) { event.preventDefault(); event.returnValue = ""; }
    };
    const beforeNavigation = (event: MouseEvent) => {
      if ((!unsaved() && !uploadFailed.current && !pendingRecovery.current) || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname && url.search === window.location.search) return;
      event.preventDefault(); event.stopPropagation();
      startTransition(async () => {
        if (!(await flush())) return;
        if (url.pathname === "/admin/homepage/preview" || url.pathname === "/admin/homepage/history") url.searchParams.set("revision", String(revisionRef.current));
        router.push(url.pathname + url.search + url.hash);
      });
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", beforeNavigation, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", beforeNavigation, true); };
  }, [flush, router]);

  function edit(updater: (current: HomeDocument) => HomeDocument) {
    if (pendingRecovery.current) return;
    latest.current = updater(latest.current);
    // Synchronous local persistence covers Back, reload, and effect timer cleanup.
    remember(active.current);
    setDoc(latest.current);
    if (!conflicted.current) { setState("dirty"); setError(""); }
  }
  function update<K extends keyof HomeDocument>(key: K, value: HomeDocument[K]) { edit(prev => ({ ...prev, [key]: value })); }
  function patch<K extends "intro" | "offer" | "picks" | "seasonal" | "guide" | "advice" | "service">(key: K, value: Partial<HomeDocument[K]>) {
    edit(prev => ({ ...prev, [key]: { ...prev[key], ...value } }));
  }
  function arrange(next: Block[]) { edit(prev => ({ ...prev, layouts: { ...prev.layouts, [prev.preset]: next } })); }
  function addPhoto(file: string) { setPhotos(prev => prev.some(p => p.value === file) ? prev : [{ value: file, label: "ატვირთული ფოტო · " + file.split("/").pop() }, ...prev]); }
  function uploadPhoto(file: File, onUploaded: (path: string) => void) {
    if (uploadInFlight.current || pendingRecovery.current) return;
    uploadFailed.current = false; setUploadError("");
    const fail = (message: string) => { uploadFailed.current = true; setUploadError(message); return false; };
    if (file.size > 8 * 1024 * 1024) { fail("აირჩიე 8 მბ-მდე ზომის ფოტო."); return; }
    setUploading(true);
    startUploadTransition(async () => {
      const upload = async () => {
        const form = new FormData(); form.set("file", file);
        try {
          const result = await uploadHomePhotoAction(form);
          if (!result.file) return fail(result.error ?? "ფოტოს ატვირთვა ვერ მოხერხდა.");
          addPhoto(result.file); onUploaded(result.file);
          return true;
        } catch { return fail("ფოტოს ატვირთვა ვერ მოხერხდა. სცადე ხელახლა."); }
      };
      uploadInFlight.current = upload().finally(() => { uploadInFlight.current = null; setUploading(false); });
      await uploadInFlight.current;
    });
  }
  function resolveRecovery(restore: boolean) {
    const stored = pendingRecovery.current;
    if (!stored) return;
    clearHomeRecovery(stored.owner);
    pendingRecovery.current = null; setRecovery(null);
    if (restore) edit(() => stored.document);
  }
  function preview() { startTransition(async () => { if (await flush()) router.push("/admin/homepage/preview?revision=" + revisionRef.current); }); }
  function cancelSchedule() {
    startTransition(async () => {
      if (!(await flush())) return;
      const form = new FormData(); form.set("revision", String(revisionRef.current)); form.set("intent", "cancel");
      await releaseHomeAction(form);
    });
  }


  return <div className="space-y-5" data-testid="home-editor">
    {recovery && <section role="status" className="space-y-3 rounded-card border border-warn/40 bg-warn-soft p-4 text-sm" data-testid="home-recovery">
      <h2 className="font-semibold">ამ ჩანართში შეუნახავი მონახაზი დარჩა</h2>
      <p>ადგილობრივი ასლი · {date(recovery.updatedAt)} · თბილისი. ჯერ აირჩიე, აღადგინო ის თუ სერვერზე შენახული მონახაზით გააგრძელო.</p>
      {recovery.revision !== currentRevision && <p className="font-medium text-warn" data-testid="home-recovery-newer">
        ადგილობრივი ასლი ვერსია {recovery.revision}-ს ეკუთვნის. სერვერზე უკვე ვერსია {currentRevision} ინახება. აღდგენა მის შინაარსს ადგილობრივი ასლით შეცვლის; შეადარე ცვლილებები.</p>}
      <div className="grid gap-3 sm:grid-cols-2"><div><p className="text-xs text-ink-2">სერვერზე შენახული</p><p>{presetNames[doc.preset]} · {doc.intro.title || "სათაური ცარიელია"}</p></div>
        <div><p className="text-xs text-ink-2">ადგილობრივი ასლი</p><p>{presetNames[recovery.document.preset]} · {recovery.document.intro.title || "სათაური ცარიელია"}</p></div></div>
      {!!recoveryChanges.length && <ul className="list-disc space-y-1 pl-5">{recoveryChanges.map((change, index) => <li key={index}>{change}</li>)}</ul>}
      <div className="flex flex-wrap gap-2"><button type="button" className={button} onClick={() => resolveRecovery(false)}>სერვერზე შენახულით გაგრძელება</button>
        <button type="button" className={primary} onClick={() => resolveRecovery(true)}>{recovery.revision === currentRevision ? "ადგილობრივი მონახაზის აღდგენა" : "ადგილობრივი ასლით ჩანაცვლება"}</button></div>
      <p className="text-xs text-ink-2">აღდგენა ცვლის მხოლოდ მონახაზს. საჯარო გვერდის შეცვლას გამოქვეყნება სჭირდება.</p>
    </section>}
    <fieldset disabled={!!recovery} className="min-w-0 space-y-5" aria-label="მთავარი გვერდის მონახაზის რედაქტირება">
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface p-4">
      <div role="status" aria-live="polite" data-testid="home-save-state"><p className="font-medium">
        {state === "saving" ? "მონახაზი ინახება…" : state === "dirty" ? "არის შეუნახავი ცვლილებები" : state === "error" ? "შენახვა ვერ შესრულდა" : state === "conflict" ? "ვერსიები ერთმანეთს არ ემთხვევა" : "მონახაზი შენახულია"}</p>
        {savedAt && <p className="mt-1 text-xs text-ink-2">ბოლო შენახვა · {date(savedAt)} · თბილისი</p>}
        <p className="mt-1 text-xs text-ink-2">საჯარო გვერდი იცვლება მხოლოდ გამოქვეყნების შემდეგ.</p>
      </div>
      <div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={busy || state === "conflict"}
        onClick={() => startTransition(async () => { await flush(); })}>მონახაზის შენახვა</button>
        <button type="button" className={primary} disabled={busy || state === "conflict"} onClick={preview}>შენახვა და წინასწარი ნახვა</button></div>
    </section>
    {uploading && <p role="status" className="rounded-card bg-accent-soft p-3 text-sm text-accent" data-testid="home-upload-state">ფოტო იტვირთება… შენახვა და გვერდის შეცვლა დაელოდება ატვირთვის დასრულებას.</p>}
    {uploadError && <section role="alert" className="space-y-2 rounded-card border border-warn/40 bg-warn-soft p-4 text-sm text-warn" data-testid="home-upload-error">
      <p>{uploadError}</p><p>ხელახლა აირჩიე ფოტო ან გააგრძელე მის გარეშე.</p>
      <button type="button" className={button} onClick={() => {
        uploadFailed.current = false; setUploadError(""); startTransition(async () => { await flush(); });
      }}>გაგრძელება ამ ფოტოს გარეშე</button>
    </section>}
    {recoveryUnavailable && <p role="status" className="rounded-card bg-warn-soft p-3 text-sm text-warn">ბრაუზერში დროებითი ასლი ვერ შეიქმნა. გვერდიდან გასვლამდე დაელოდე მონახაზის შენახვას.</p>}
    {error && <section role="alert" className="space-y-2 rounded-card border border-warn/40 bg-warn-soft p-4 text-sm text-warn">
      <p>{error}</p>{state === "conflict" && <><p>შენი ცვლილებები ეკრანზე დარჩა. შეადარე ბოლო შენახულ ვერსიას ცალკე ჩანართში, სანამ გვერდს განაახლებ.</p>
        <a href="/admin/homepage" target="_blank" rel="noreferrer" className="underline">ბოლო ვერსიის ცალკე გახსნა</a></>}
    </section>}
    {suggested && <section className={panel} data-testid="home-feature-product"><h2 className="font-semibold">პროდუქტის მთავარ გვერდზე გამორჩევა</h2>
      <div className="flex items-center gap-3"><ProductSummary product={suggested} photos={photoSet}/></div>
      <div className="grid gap-3 sm:grid-cols-2">{(["picks", "seasonal"] as const).map(key => {
        const collection = doc[key];
        const ids = collection.mode === "manual" ? collection.ids : selectCollection(collection, catalog.products).map(product => product.id);
        const included = ids.includes(suggested.id);
        const full = ids.length >= 8 && !included;
        return <div key={key} className="space-y-2 rounded-card border border-line p-3"><h3 className="text-sm font-medium">{blockNames[key]}</h3>
          <p className="text-xs text-ink-2">{included ? "პროდუქტი უკვე არჩეულია." : full ? "შერჩევაში უკვე 8 პროდუქტია. ჯერ გაათავისუფლე ადგილი." :
            collection.mode === "type" ? "დაემატება არსებულ პროდუქტებს და შერჩევა ხელით მართვაზე გადავა." : "დაემატება შერჩევის ბოლოში."}</p>
          {!full && !included && <button type="button" className={button} onClick={() => {
            edit(prev => ({ ...prev, [key]: { ...prev[key], mode: "manual", ids: [...ids, suggested.id], limit: 8, sort: "recommended" },
              layouts: { ...prev.layouts, [prev.preset]: prev.layouts[prev.preset].includes(key) ? prev.layouts[prev.preset] : [...prev.layouts[prev.preset], key] } }));
            setSection(key);
          }}>მონახაზში დამატება</button>}
          <button type="button" className={button} onClick={() => setSection(key)}>შერჩევის მართვა</button>
        </div>;
      })}</div><p className="text-xs text-ink-2">ეს მოქმედება ცვლის მონახაზს. გამოსაქვეყნებლად შეამოწმე წინასწარი ხედი.</p>
    </section>}
    {activeSchedule && schedule && <section className={panel}>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">{campaign ? "მიმდინარე კამპანია" : "დაგეგმილი გამოქვეყნება"}</h2>
        <p className="mt-1 text-sm text-ink-2">{presetNames[schedule.document.preset]} · {schedule.start.replace("T", " ")}{schedule.end && " — " + schedule.end.replace("T", " ")} · თბილისი</p>
        {campaign && <p className="mt-1 text-sm text-ink-2">ძირითადი ვერსიის განახლება შესაძლებელია. კამპანიის დასრულების შემდეგ სწორედ ის გამოჩნდება.</p>}</div>
        <button type="button" className={button} disabled={busy || state === "conflict"} onClick={cancelSchedule}>{campaign ? "კამპანიის დასრულება" : !schedule.end && localTime(schedule.start) <= now ? "დაგეგმვის გაუქმება" : "განრიგის გაუქმება"}</button></div>
    </section>}
    <fieldset className={panel}><legend className="px-1 font-semibold">განლაგება</legend>
      <div className="grid gap-3 md:grid-cols-3">{presets.map(preset => <label key={preset}
        className={"cursor-pointer rounded-card border p-3 " + (doc.preset === preset ? "border-accent bg-accent-soft" : "border-line")}>
        <span className="flex items-start gap-2 text-sm font-semibold"><input type="radio" name="preset" value={preset} className="mt-1"
          checked={doc.preset === preset} onChange={() => update("preset", preset)}/>{presetNames[preset]}</span>
        <LayoutSample preset={preset}/><span className="block text-sm text-ink-2">{presetSummaries[preset]}</span>
      </label>)}</div><p className="text-sm text-ink-2">კომპოზიციის შეცვლისას ტექსტები, ფოტოები და შერჩევები შენარჩუნდება.</p>
    </fieldset>
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(15rem,1fr)_minmax(0,2fr)]">
      <section className={panel + " lg:sticky lg:top-4"}><h2 className="font-semibold">ბლოკები</h2>
        <button type="button" aria-pressed={section === "intro"} onClick={() => setSection("intro")} className={button + (section === "intro" ? " bg-accent-soft" : "")}>შესავალი</button>
        <ul className="divide-y divide-line">{[...layout, ...blocks.filter(key => !layout.includes(key))].map(key => {
          const index = layout.indexOf(key);
          return <li key={key} className="space-y-1 py-3"><div className="flex items-center gap-2">
            <input type="checkbox" aria-label={blockNames[key] + " · ჩართვა"} checked={index >= 0} disabled={key === doc.preset || key === "catalog"}
              onChange={() => arrange(index < 0 ? [...layout, key] : layout.filter(k => k !== key))}/>
            <button type="button" aria-pressed={section === key} onClick={() => setSection(key)} className={"min-h-11 flex-1 text-left text-sm " + (section === key ? "font-bold text-accent" : "")}>{blockNames[key]}</button>
            {index > 0 && <div className="flex"><button type="button" disabled={index === 1} aria-label={blockNames[key] + " ზემოთ"} className="h-11 w-10 disabled:opacity-30" onClick={() => arrange(move(layout, index, -1))}>↑</button>
              <button type="button" disabled={index === layout.length - 1} aria-label={blockNames[key] + " ქვემოთ"} className="h-11 w-10 disabled:opacity-30" onClick={() => arrange(move(layout, index, 1))}>↓</button></div>}
          </div>{index < 0 && <p className="ml-6 text-xs text-ink-2">შენახულია · ამ კომპოზიციაში არ ჩანს</p>}</li>;
        })}</ul>
        <p className="text-xs text-ink-2">პირველი ბლოკი კომპოზიციით განისაზღვრება. კატეგორიები და „საიდან დავიწყოთ?“ — ძიება, სამუშაოს მიხედვით არჩევა და დახმარება — სამივე კომპოზიციაში ჩანს. ეს სამი მუდმივი გზა საერთო სტანდარტის ნაწილია.</p>
      </section>
      <section className={panel} aria-label="ბლოკის შინაარსი"><header><h2 className="font-semibold">{section === "intro" ? "შესავალი" : blockNames[section]}</h2>
        <p className="mt-1 text-sm text-ink-2">{descriptions[section]}</p></header>
        {section !== "intro" && !layout.includes(section) && <p className="rounded-card bg-bg p-3 text-sm text-ink-2">ამ ბლოკის შინაარსი ინახება. საჩვენებლად ჩართე ის ბლოკების სიაში.</p>}
        {section === "intro" && <>
          <TextField label="მთავარი სათაური" value={doc.intro.title} onChange={title => patch("intro", { title })}/>
          <TextField long label="შესავლის ტექსტი" value={doc.intro.text} onChange={text => patch("intro", { text })}/>
          <PhotoSettings value={doc.intro} photos={photos} uploading={uploading} onUpload={uploadPhoto} onChange={value => patch("intro", value)}/>
          <TargetFields value={doc.intro.target} categories={categories} types={types} products={products} photos={photoSet} onChange={target => patch("intro", { target })}/>
          {doc.preset === "offer" && <p className="text-sm text-ink-2">აქტიური შეთავაზება პირველ ადგილზე გამოჩნდება. შესავალი მისთვის შემცვლელი შინაარსია.</p>}
        </>}
        {section === "catalog" && <>
          <TextField label="სექციის სათაური" value={doc.catalogTitle} onChange={value => update("catalogTitle", value)}/>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!doc.categoryIds.length}
            onChange={e => update("categoryIds", e.target.checked ? [] : categories.map(c => c.value))}/>ყველა კატეგორიის ჩვენება</label>
          {!!doc.categoryIds.length && <ol className="space-y-2">{doc.categoryIds.map((id, index) => <li key={id} className="flex flex-wrap items-center gap-2 rounded-card border border-line p-2">
            <span className="mr-auto text-sm">{categories.find(c => c.value === id)?.label ?? id}</span>
            <button type="button" className={button} disabled={!index} aria-label="კატეგორია ზემოთ" onClick={() => update("categoryIds", move(doc.categoryIds, index, -1))}>↑</button>
            <button type="button" className={button} disabled={index === doc.categoryIds.length - 1} aria-label="კატეგორია ქვემოთ" onClick={() => update("categoryIds", move(doc.categoryIds, index, 1))}>↓</button>
            <button type="button" className={button} disabled={doc.categoryIds.length === 1} onClick={() => update("categoryIds", doc.categoryIds.filter(value => value !== id))}>ამოღება</button>
          </li>)}</ol>}
          {!!doc.categoryIds.length && categories.some(c => !doc.categoryIds.includes(c.value)) && <Choice label="კატეგორიის დამატება" value="" empty="აირჩიე კატეგორია"
            options={categories.filter(c => !doc.categoryIds.includes(c.value))} onChange={id => { if (id) update("categoryIds", [...doc.categoryIds, id]); }}/>}
          <p className="text-xs text-ink-2">აქ იცვლება მთავარ გვერდზე გამორჩეული კატეგორიები. კატალოგის სახელები და სტრუქტურა საერთო კატალოგში იმართება.</p>
        </>}
        {(section === "picks" || section === "seasonal") && <CollectionFields key={section} collectionKey={section}
          collection={doc[section]} products={products} allProducts={catalog.products} types={types} photoSet={photoSet}
          onChange={value => patch(section, value)} onAdd={id => edit(prev => ({ ...prev,
            [section]: { ...prev[section], ids: [...prev[section].ids, id] } }))}/>}
        {section === "offer" && <>
          <TextField label="შეთავაზების სათაური" value={doc.offer.title} onChange={title => patch("offer", { title })}/>
          <ProductPicker label="პროდუქტი" value={doc.offer.product} products={products} photos={photoSet} allowAutomatic onChange={product => patch("offer", { product })}/>
          <TextField label="მოკლე ტექსტი" long value={doc.offer.text} onChange={text => patch("offer", { text })}/>
          <PhotoSettings value={doc.offer} photos={photos} uploading={uploading} onUpload={uploadPhoto} onChange={value => patch("offer", value)}/>
          <details className="rounded-card border border-line p-3"><summary className="cursor-pointer text-sm font-medium">შეთავაზების მოქმედება და შემცვლელი ბლოკი</summary>
            <div className="mt-3 space-y-3"><div className="grid gap-3 sm:grid-cols-2">{(["start", "end"] as const).map(key => <label key={key} className="block text-sm">
              {key === "start" ? "დაწყება" : "დასრულება"} · თბილისი<input className="mt-1 w-full rounded-card border border-line bg-bg px-3 py-2" type="datetime-local" value={doc.offer[key]}
                onChange={e => patch("offer", { [key]: e.target.value })}/></label>)}</div>
              <Choice label="თუ შეთავაზება მიუწვდომელია" options={[{ value: "hide", label: "ბლოკის დამალვა" }, { value: "picks", label: "ჩვენი შერჩევით ჩანაცვლება" }]}
                value={doc.offer.fallback} onChange={value => patch("offer", { fallback: value === "hide" ? "hide" : "picks" })}/>
            </div></details>
          <p className="text-sm text-ink-2">ფასი მოდის მაღაზიის მოქმედი აქციიდან. ამ ვადების შეცვლა პროდუქტის ფასდაკლების ვადას არ ცვლის.</p>
        </>}
        {section === "guide" && <>
          <TextField label="სექციის სათაური" value={doc.guide.title} onChange={title => patch("guide", { title })}/>
          {doc.guide.tasks.map((task, index) => {
            const change = (value: Partial<typeof task>) => edit(prev => ({ ...prev, guide: { ...prev.guide,
              tasks: prev.guide.tasks.map((item, i) => i === index ? { ...item, ...value } : item) } }));
            return <fieldset key={index} className="space-y-3 rounded-card border border-line p-3"><legend className="px-1 text-sm font-medium">ამოცანა {index + 1}</legend>
              <TextField label="ამოცანის სახელწოდება" value={task.title} onChange={title => change({ title })}/>
              <TextField long label="განმარტება" value={task.text} onChange={text => change({ text })}/>
              <Choice label="შესაბამისი პროდუქტები" value={task.type} options={types} empty="აირჩიე ტიპი" onChange={type => change({ type })}/>
              <div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={!index} onClick={() => patch("guide", { tasks: move(doc.guide.tasks, index, -1) })}>↑ ზემოთ</button>
                <button type="button" className={button} disabled={index === doc.guide.tasks.length - 1} onClick={() => patch("guide", { tasks: move(doc.guide.tasks, index, 1) })}>↓ ქვემოთ</button>
                <button type="button" className={button} onClick={() => patch("guide", { tasks: doc.guide.tasks.filter((_, i) => i !== index) })}>ამოცანის ამოღება</button></div>
            </fieldset>;
          })}
          {doc.guide.tasks.length < 6 && <button type="button" className={button} onClick={() => patch("guide", {
            tasks: [...doc.guide.tasks, { title: "", text: "", type: types[0]?.value ?? "" }],
          })}>ამოცანის დამატება</button>}
        </>}
        {section === "popular" && <>
          <TextField label="სექციის სათაური" value={doc.popularTitle} onChange={value => update("popularTitle", value)}/>
          <p className="text-sm text-ink-2">გამოიყენება ბოლო 30 დღის გადახდილი, დადასტურებული შეკვეთები. გაუქმებული და დაბრუნებული შეკვეთები გამორიცხულია. მონაცემების გარეშე გამოჩნდება „ჩვენი შერჩევა“.</p>
          <p className="text-sm font-medium">ახლა გამოჩნდება {diagnostics.counts.popular} პროდუქტი</p>
        </>}
        {section === "advice" && <>
          <TextField label="რჩევის სათაური" value={doc.advice.title} onChange={title => patch("advice", { title })}/>
          <TextField long label="რჩევის ტექსტი" value={doc.advice.text} onChange={text => patch("advice", { text })}/>
          <TargetFields value={doc.advice.target} categories={categories} types={types} products={products} photos={photoSet} onChange={target => patch("advice", { target })}/>
        </>}
        {section === "service" && <>
          <TextField label="სექციის სათაური" value={doc.service.title} onChange={title => patch("service", { title })}/>
          <div className="space-y-3">{(Object.keys(serviceNames) as ServiceItem[]).map(item => <label key={item} className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={doc.service.items.includes(item)} onChange={e => patch("service", {
              items: e.target.checked ? [...doc.service.items, item] : doc.service.items.filter(value => value !== item),
            })}/>{serviceNames[item]}</label>)}</div>
          <p className="text-sm text-ink-2">პირობები და საკონტაქტო მონაცემები მაღაზიის საერთო პარამეტრებიდან გამოჩნდება.</p>
          <Link className="text-sm text-accent underline" href="/admin/settings">მაღაზიის პარამეტრები</Link>
        </>}
      </section>
    </div>
    <section className={panel}><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">გამოქვეყნების შემოწმება</h2>
      <p className="mt-1 text-sm text-ink-2">ვერსია {currentRevision} · {changes.length ? `${changes.length} ცვლილების ჯგუფი` : "ძირითად ვერსიას ემთხვევა"}</p></div>
      <button type="button" className={primary} disabled={busy || state === "conflict"} onClick={preview}>შენახვა და წინასწარი ნახვა</button></div>
      {diagnostics.errors.length > 0 && <div className="space-y-1 text-sm text-warn"><h3 className="font-semibold">გამოქვეყნებამდე შესასწორებელია</h3><ul className="list-disc space-y-1 pl-5">{diagnostics.errors.map(issue => <li key={issue.code + issue.message}>{issue.message}</li>)}</ul></div>}
      {diagnostics.warnings.length > 0 && <details><summary className="cursor-pointer text-sm font-medium">შენიშვნები · {diagnostics.warnings.length}</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">{diagnostics.warnings.map(issue => <li key={issue.code + issue.message}>{issue.message}</li>)}</ul></details>}
      {!diagnostics.errors.length && <p className="text-sm text-accent">გამოქვეყნების დამაბრკოლებელი პრობლემა არ ჩანს.</p>}
    </section>
    </fieldset>
  </div>;
}
