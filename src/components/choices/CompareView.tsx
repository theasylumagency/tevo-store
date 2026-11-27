"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type CSSProperties, type FocusEvent } from "react";
import { buildComparisonRows, sameComparisonType } from "@/lib/choices/comparison";
import { comparisonHref, MAX_COMPARE, type ChoiceProduct, type ChoiceResult } from "@/lib/choices/types";
import { Price } from "@/components/Price";
import { useChoices } from "./ChoiceProvider";
import { useChoiceProducts } from "./useChoiceProducts";
import ui from "../storefront/foundation.module.css";
import css from "./comparison.module.css";

function ComparisonPhoto({ product }: { product: ChoiceProduct }) {
  const [failed, setFailed] = useState(false);
  return <div className={css.photo}>
    {product.image && !failed
      ? <Image src={product.image} alt={product.name} fill sizes="220px" onError={() => setFailed(true)} />
      : <span role="img" aria-label={`${product.name} — ფოტო არ არის ხელმისაწვდომი`}>ფოტო არ არის ხელმისაწვდომი</span>}
  </div>;
}

function ComparisonSave({ product }: { product: ChoiceProduct }) {
  const choices = useChoices();
  const [error, setError] = useState("");
  const messageId = useId();
  const saved = choices.savedIds.includes(product.id);
  return <div className={css.saveControl}>
    <button type="button" className={css.save} disabled={!choices.ready} aria-pressed={saved}
      aria-label={`${saved ? "შენახულიდან ამოღება" : "შენახვა"}: ${product.name}`} aria-describedby={error ? messageId : undefined}
      onClick={() => { const result = choices.toggleSaved(product.id); setError(result.ok ? "" : result.message); }}>{saved ? "შენახულია" : "შენახვა"}</button>
    {error && <p id={messageId} className={css.note}>{error}</p>}
  </div>;
}

/** Native focus scrolling does not account for sticky table headings. */
function revealFocusedControl(event: FocusEvent<HTMLDivElement>) {
  const region = event.currentTarget;
  const control = event.target;
  if (!(control instanceof HTMLElement) || control === region) return;
  const reveal = () => {
    if (!control.isConnected || document.activeElement !== control || !region.clientWidth) return;
    const bounds = region.getBoundingClientRect();
    const rect = control.getBoundingClientRect();
    const header = region.querySelector("thead")?.getBoundingClientRect();
    const corner = region.querySelector("thead th")?.getBoundingClientRect();
    // The outer box includes the reserved scrollbar gutter; only the client box
    // can actually show the focused control on platforms with classic scrollbars.
    const visibleLeft = bounds.left + region.clientLeft;
    const visibleTop = bounds.top + region.clientTop;
    const visibleRight = visibleLeft + region.clientWidth;
    const visibleBottom = visibleTop + region.clientHeight;
    const leftEdge = Math.max(visibleLeft, corner?.right ?? visibleLeft) + 6;
    const topEdge = control.closest("thead") ? visibleTop + 6 : Math.max(visibleTop, header?.bottom ?? visibleTop) + 6;
    const left = rect.left < leftEdge ? rect.left - leftEdge : rect.right > visibleRight - 8 ? rect.right - visibleRight + 8 : 0;
    const top = rect.top < topEdge ? rect.top - topEdge : rect.bottom > visibleBottom - 8 ? rect.bottom - visibleBottom + 8 : 0;
    if (left || top) region.scrollBy({ left, top, behavior: "auto" });
  };
  reveal();
  // Native focus() scrolling runs after focus events and can overwrite the
  // first correction. Recheck after it finishes, unless focus has moved on.
  requestAnimationFrame(reveal);
}

export function CompareView({ sharedIds, initial, trimmed = false }: {
  sharedIds?: string[];
  initial?: ChoiceResult;
  trimmed?: boolean;
}) {
  const choices = useChoices();
  const router = useRouter();
  const shared = sharedIds !== undefined;
  const ids = sharedIds ?? choices.comparedIds;
  const { result, loading, error, retry } = useChoiceProducts(ids, initial);
  const [differencesOnly, setDifferencesOnly] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [shareIds, setShareIds] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shareRef = useRef<HTMLInputElement>(null);
  const regionId = useId();
  const products = result?.products ?? [];
  const missingIds = result?.missingIds ?? [];
  const sameType = sameComparisonType(products);
  const adopted = products.length > 0 && products.map((p) => p.id).join("|") === choices.comparedIds.join("|");
  const rows = buildComparisonRows(products);
  const differencesActive = differencesOnly && products.length > 1;
  const shownRows = differencesActive ? rows.filter((row) => row.different) : rows;
  const waiting = !shared && !choices.ready || loading && !result;

  function changeIds(next: string[]) {
    setShareUrl("");
    setShareMessage("");
    setActionMessage("");
    if (shared) router.replace(next.length ? comparisonHref(next) : "/compare?ids=", { scroll: false });
    else if (next.length === 0) choices.clearCompared();
    else ids.filter((id) => !next.includes(id)).forEach((id) => choices.removeCompared(id));
    headingRef.current?.focus({ preventScroll: true });
  }

  async function copyLink() {
    const url = `${window.location.origin}${comparisonHref(ids)}`;
    setShareIds(ids.join("|"));
    setShareUrl(url);
    try {
      await navigator.clipboard.writeText(url);
      setShareMessage("შედარების ბმული დაკოპირებულია.");
    } catch {
      setShareMessage("მონიშნე და დააკოპირე ქვემოთ მოცემული ბმული.");
      requestAnimationFrame(() => { shareRef.current?.focus(); shareRef.current?.select(); });
    }
  }

  return <div className={css.page} data-choice-comparison>
    <header className={css.heading}>
      <h1 ref={headingRef} tabIndex={-1} className={ui.pageTitle}>პროდუქტების შედარება</h1>
      <p className={ui.lead}>შეადარე ერთი ტიპის ოთხ პროდუქტამდე. განსხვავებები მონიშნულია; შეუვსებელი მახასიათებელი ნიშნავს, რომ ინფორმაცია მითითებული არ არის.</p>
    </header>

    {shared && <div className={`${ui.notice} ${css.shared}`}>
      <p>გახსნილია ბმულში შერჩეული პროდუქტები. შენი შენახული შედარება ცალკე რჩება.</p>
      {sameType && products.length > 0 && !error && <button type="button" disabled={!choices.ready} aria-disabled={adopted} className={ui.secondaryAction}
        onClick={() => { if (!adopted) setActionMessage(choices.replaceCompared(products.map((p) => p.id)).message); }}>
        {adopted ? "ჩემს შედარებაშია" : "ჩემს შედარებაში შენახვა"}
      </button>}
      <Link href="/compare" className={ui.quietAction}>ჩემი შედარება</Link>
    </div>}
    {trimmed && <p className={ui.notice}>ბმულში ზოგი არჩევანი გამოტოვებულია. გამოიყენება მაქსიმუმ ოთხი პროდუქტი და მხოლოდ ამოსაცნობი პროდუქტის კოდები.</p>}
    {actionMessage && <p className={ui.notice}>{actionMessage}</p>}
    {!choices.persistent && choices.ready && <p className={ui.notice}>ბრაუზერში შენახვა მიუწვდომელია. შენი არჩევანი ამ ჩანართში მუშაობს; მოგვიანებით გასახსნელად შედარების ბმული დააკოპირე.</p>}

    {waiting ? <section className={ui.state} role="status"><h2 className={ui.stateTitle}>შედარება იტვირთება</h2><p className={ui.stateCopy}>ვამოწმებთ შერჩეული პროდუქტების მიმდინარე მონაცემებს.</p></section>
      : error ? <section className={ui.state} role="alert"><h2 className={ui.stateTitle}>მონაცემები ვერ ჩაიტვირთა</h2><p className={ui.stateCopy}>შენი არჩევანი შენარჩუნებულია. მიმდინარე ფასებისა და მახასიათებლების სანახავად ხელახლა სცადე.</p><button type="button" onClick={retry} className={ui.primaryAction}>ხელახლა ცდა</button></section>
        : <>
          {missingIds.length > 0 && <div className={`${ui.notice} ${css.notice}`} role="status">
            <p>{missingIds.length} პროდუქტი მოქმედ კატალოგში ვერ მოიძებნა. მისი ძველი ფასი და მახასიათებლები არ გამოჩნდება.</p>
            <div><button type="button" className={ui.quietAction} onClick={() => changeIds(ids.filter((id) => !missingIds.includes(id)))}>მიუწვდომელი პროდუქტების ამოღება</button></div>
          </div>}

          {products.length === 0 ? <section className={ui.state}>
            <h2 className={ui.stateTitle}>შეარჩიე პროდუქტები შესადარებლად</h2>
            <p className={ui.stateCopy}>კატალოგში ან პროდუქტის გვერდზე მონიშნე „შედარება“. აქ ერთ სივრცეში ნახავ ფასს, მახასიათებლებსა და ხელმისაწვდომობას.</p>
            <div className={ui.actions}><Link href="/search" className={ui.primaryAction}>კატალოგის ნახვა</Link><Link href="/saved" className={ui.secondaryAction}>შენახული პროდუქტები</Link></div>
          </section> : <>
            <div className={css.toolbar}>
              {sameType && <label className={css.toggle}><input type="checkbox" checked={differencesActive} disabled={products.length < 2} onChange={(event) => setDifferencesOnly(event.target.checked)} />მხოლოდ განსხვავებები</label>}
              <div className={css.toolbarActions}>
                <button type="button" onClick={copyLink} className={ui.secondaryAction}>ბმულის კოპირება</button>
                <button type="button" onClick={() => changeIds([])} className={ui.quietAction}>შედარების გასუფთავება</button>
              </div>
            </div>
            {shareUrl && shareIds === ids.join("|") && <div className={`${ui.notice} ${css.share}`}>
              <label htmlFor={`${regionId}-share`}>შედარების ბმული</label>
              <input ref={shareRef} id={`${regionId}-share`} value={shareUrl} readOnly onFocus={(event) => event.currentTarget.select()} />
              <p className={css.note} role="status">{shareMessage}</p>
              <p className={css.note}>ბმულის გახსნისას გამოჩნდება პროდუქტების იმჟამინდელი ფასი და მონაცემები.</p>
            </div>}

            {!sameType ? <section className={css.notice} aria-labelledby={`${regionId}-mixed`}>
              <h2 id={`${regionId}-mixed`} className={ui.sectionTitle}>აირჩიე ერთი ტიპის პროდუქტები</h2>
              <p className={ui.lead}>ამ შერჩევაში სხვადასხვა ტიპის პროდუქტებია. ამოიღე განსხვავებული ტიპი, რათა მახასიათებლები აზრიანად შეადარო.</p>
              <ul className={css.mixedList}>{products.map((product) => <li className={css.mixedItem} key={product.id}>
                <div><Link href={`/p/${product.slug}`}>{product.name}</Link><p>{product.productTypeLabel}</p></div>
                <button type="button" className={css.remove} aria-label={`შედარებიდან ამოღება: ${product.name}`} onClick={() => changeIds(ids.filter((id) => id !== product.id))}>ამოღება</button>
              </li>)}</ul>
            </section> : <>
              {products.length === 1 && <div className={`${ui.notice} ${css.shared}`}>
                <p>პირველი პროდუქტი შერჩეულია. განსხვავებების სანახავად დაამატე იმავე ტიპის კიდევ ერთი პროდუქტი.</p>
                <Link href={products[0].typeHref} className={ui.quietAction}>იმავე ტიპის პროდუქტები</Link>
              </div>}
              <div>
                <p id={`${regionId}-hint`} className={css.scrollHint}>ცხრილი გადაადგილდება ჰორიზონტალურად და ვერტიკალურად; პროდუქტის სახელი და მახასიათებლის დასახელება ადგილზე რჩება. კლავიატურით: მონიშნე ცხრილი და გამოიყენე ისრები.</p>
                <div className={css.tableRegion} role="region" aria-label="პროდუქტების მახასიათებლების შედარება" aria-describedby={`${regionId}-hint`} tabIndex={0} onFocusCapture={revealFocusedControl}>
                  <table className={css.table} style={{ "--comparison-columns": products.length } as CSSProperties}>
                    <caption className="sr-only">{products.length} პროდუქტის ფასი, ხელმისაწვდომობა და ტექნიკური მახასიათებლები</caption>
                    <colgroup><col className={css.labelColumn} />{products.map((p) => <col key={p.id} />)}</colgroup>
                    <thead><tr><th scope="col" className={css.corner}>მახასიათებელი</th>{products.map((product) => <th scope="col" key={product.id}>
                      <div className={css.columnTitle}>
                        <Link href={`/p/${product.slug}`}>{product.name}</Link>
                        {product.model && <span className={css.columnModel}>{product.model}</span>}
                        <button type="button" className={css.remove} aria-label={`შედარებიდან ამოღება: ${product.name}`} onClick={() => changeIds(ids.filter((id) => id !== product.id))}>ამოღება</button>
                      </div>
                    </th>)}</tr></thead>
                    <tbody>
                      <tr><th scope="row" className={css.rowHeading}>პროდუქტი</th>{products.map((product) => <td key={product.id}><div className={css.overview}>
                        <ComparisonPhoto key={`${product.id}:${product.image}`} product={product} />
                        <Price price={product.price} />
                        <Link href={`/p/${product.slug}`} className={`${ui.primaryAction} ${css.openProduct}`}>პროდუქტის ნახვა</Link>
                        <ComparisonSave product={product} />
                      </div></td>)}</tr>
                      {shownRows.map((row) => <tr key={row.key} className={row.different ? css.different : undefined} data-comparison-row={row.key}>
                        <th scope="row" className={css.rowHeading}>{row.label}{row.different && <span className="sr-only"> — განსხვავდება</span>}</th>
                        {row.values.map((value, index) => <td key={products[index].id}>{value === null ? <span className={css.missing}>{row.kind === "price" ? "ფასი დასაზუსტებელია" : "არ არის მითითებული"}</span> : value}</td>)}
                      </tr>)}
                    </tbody>
                  </table>
                </div>
              </div>
              {differencesActive && shownRows.length === 0 && <p className={ui.notice} role="status">მითითებულ მონაცემებში განსხვავება არ ჩანს. შეუვსებელი ველები პროდუქტების იდენტურობას არ ადასტურებს.</p>}
              <div className={css.toolbar}><p className={css.note}>{products.length} / {MAX_COMPARE} პროდუქტი · {products[0].productTypeLabel}</p><Link href={products[0].typeHref} className={ui.quietAction}>იმავე ტიპის პროდუქტების ნახვა</Link></div>
            </>}
          </>}
        </>}
  </div>;
}
