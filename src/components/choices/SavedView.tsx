"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { Price } from "@/components/Price";
import { t } from "@/i18n";
import type { ChoiceProduct } from "@/lib/choices/types";
import { useChoices } from "./ChoiceProvider";
import { ProductChoiceActions } from "./ProductChoiceActions";
import { useChoiceProducts } from "./useChoiceProducts";
import ui from "../storefront/foundation.module.css";
import css from "./saved.module.css";

function SavedPhoto({ product }: { product: ChoiceProduct }) {
  const [failed, setFailed] = useState(false);
  return <div className={css.photo} aria-hidden="true">
    {product.image && !failed
      ? <Image src={product.image} alt="" fill sizes="88px" onError={() => setFailed(true)} />
      : <span>ფოტო არ არის</span>}
  </div>;
}

export function SavedView() {
  const choices = useChoices();
  const { result, loading, error, retry } = useChoiceProducts(choices.savedIds);
  const [removed, setRemoved] = useState<{ id: string; name: string } | null>(null);
  const [undoError, setUndoError] = useState("");
  const [type, setType] = useState("");
  const undoRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const restoredId = useRef<string | null>(null);
  const products = result?.products ?? [];
  const types = [...new Map(products.map((p) => [p.productType, p.productTypeLabel])).entries()];
  const selectedType = types.some(([id]) => id === type) ? type : "";
  const shown = selectedType ? products.filter((p) => p.productType === selectedType) : products;

  function remove(product: ChoiceProduct) {
    setRemoved({ id: product.id, name: product.name });
    setUndoError("");
    choices.removeSaved(product.id);
    requestAnimationFrame(() => undoRef.current?.focus());
  }

  function undo() {
    if (!removed) return;
    if (!choices.savedIds.includes(removed.id)) {
      const outcome = choices.toggleSaved(removed.id);
      if (!outcome.ok) { setUndoError(outcome.message); return; }
    }
    restoredId.current = removed.id;
    setType("");
    setRemoved(null);
    setUndoError("");
  }

  return <div className={css.body}>
    <header className={css.heading}><h1 ref={headingRef} tabIndex={-1} className={ui.pageTitle}>შენახული პროდუქტები</h1>
      <p className={ui.lead}>საინტერესო ვარიანტები ერთ ადგილას, მშვიდად არჩევისთვის.</p>
    </header>
    <p className={ui.notice}>შენახული პროდუქტები ამ ბრაუზერსა და მოწყობილობაზე რჩება. მათი შენახვა რეგისტრაციას არ მოითხოვს. ფასი და ხელმისაწვდომობა მოქმედი კატალოგიდან ახლდება.</p>
    {choices.ready && !choices.persistent && <p className={ui.notice}>ბრაუზერში მუდმივი შენახვა მიუწვდომელია. შენი არჩევანი დროებით ინახება და გვერდის განახლების ან ჩანართის დახურვისას წაიშლება.</p>}
    {removed && <div className={`${ui.notice} ${css.feedback}`}>
      <p>შენახულიდან ამოღებულია: {removed.name}{undoError && <span role="alert"> {undoError}</span>}</p>
      <button type="button" className={ui.secondaryAction} ref={undoRef} onClick={undo}>დაბრუნება</button>
    </div>}
    {!choices.ready || loading ? <p role="status" className={ui.notice}>შენახული პროდუქტები მოწმდება…</p> : error ? <section className={ui.state} aria-labelledby="saved-error-title">
      <h2 id="saved-error-title" className={ui.stateTitle}>პროდუქტები ვერ განახლდა</h2>
      <p className={ui.stateCopy}>შენახული არჩევანი შენარჩუნებულია. ფასებისა და ხელმისაწვდომობის მისაღებად ხელახლა სცადე.</p>
      <button className={ui.primaryAction} type="button" onClick={retry}>ხელახლა ცდა</button>
    </section> : <>
      {Boolean(result?.missingIds.length) && <div className={`${ui.notice} ${css.feedback}`}>
        <p>{result!.missingIds.length} შენახული პროდუქტი კატალოგში ამჟამად აღარ ჩანს. მათი მონაცემები მოძველებული ინფორმაციით არ ჩანაცვლდება.</p>
        <button type="button" className={ui.secondaryAction} onClick={() => {
          result!.missingIds.forEach(choices.removeSaved);
          headingRef.current?.focus({ preventScroll: true });
        }}>ამ ჩანაწერების ამოღება</button>
      </div>}
      {products.length === 0 ? <section className={ui.state} aria-labelledby="saved-empty-title">
        <h2 id="saved-empty-title" className={ui.stateTitle}>{choices.savedIds.length ? "შენახული პროდუქტები ახლა არ ჩანს" : "მოგეწონა? შეინახე და მოგვიანებით დაუბრუნდი"}</h2>
        <p className={ui.stateCopy}>პროდუქტის ბარათზე ან გვერდზე შენახვის ნიშნით შეაგროვე საინტერესო ვარიანტები. შემდეგ ერთი ტიპის პროდუქტები ერთმანეთს შეადარე.</p>
        <Link href="/search" className={ui.primaryAction}>კატალოგის ნახვა</Link>
      </section> : <>
        <div className={css.toolbar}>
          <div><h2 className={ui.sectionTitle}>{products.length} შენახული პროდუქტი</h2><p>შესადარებლად აირჩიე ერთი ტიპის მაქსიმუმ 4 პროდუქტი.</p></div>
          <Link href="/compare" className={ui.secondaryAction}>შედარება ({choices.comparedIds.length})</Link>
        </div>
        {types.length > 1 && <label className={css.typeFilter}><span>პროდუქტის ტიპი</span>
          <select value={selectedType} onChange={(event) => setType(event.target.value)}>
            <option value="">ყველა ტიპი</option>{types.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>}
        <ul className={css.list}>
          {shown.map((product) => <li key={product.id} className={css.item} data-saved-product={product.id}>
            <SavedPhoto key={product.image} product={product} />
            <div className={css.identity}>
              <span className={css.type}>{product.productTypeLabel}</span>
              <Link href={`/p/${product.slug}`} className={css.name} ref={(node) => {
                if (node && restoredId.current === product.id) { node.focus(); restoredId.current = null; }
              }}>{product.name}</Link>
              {(product.brand || product.model) && <p>{[product.brand, product.model].filter(Boolean).join(" · ")}</p>}
            </div>
            <div className={css.price}><Price price={product.price} />
              <p className={css.availability}>{t(`product.availability.${product.availability}`)}</p>
            </div>
            <div className={css.itemActions}>
              <ProductChoiceActions productId={product.id} productName={product.name} showSave={false} />
              <button type="button" className={css.remove} aria-label={`შენახულიდან ამოღება — ${product.name}`} onClick={() => remove(product)}>ამოღება</button>
            </div>
          </li>)}
        </ul>
        <Link href="/search" className={ui.quietAction}>კატალოგში დაბრუნება</Link>
      </>}
    </>}
  </div>;
}
