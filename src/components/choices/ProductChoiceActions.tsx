"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { useOptionalChoices } from "./ChoiceProvider";
import css from "./choice-controls.module.css";

function BookmarkIcon({ active }: { active: boolean }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"}
    stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4V4Z" />
  </svg>;
}

function CompareIcon({ active }: { active: boolean }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {active ? <path d="m5 12 4 4 10-10" /> : <><path d="M8 4v16M16 4v16M4 8h8M12 16h8" /><circle cx="8" cy="8" r="2" fill="var(--surface)" /><circle cx="16" cy="16" r="2" fill="var(--surface)" /></>}
  </svg>;
}

export function ProductChoiceActions({ productId, productName, compact = false, showSave = true }: {
  productId: string;
  productName: string;
  compact?: boolean;
  showSave?: boolean;
}) {
  const choices = useOptionalChoices();
  const [notice, setNotice] = useState<{ message: string; href: string; label: string } | null>(null);
  const noticeId = useId();
  // Keep card geometry identical in private previews, with inert controls and
  // no shopping-state access when the storefront provider is absent.
  const saved = choices?.savedIds.includes(productId) ?? false;
  const compared = choices?.comparedIds.includes(productId) ?? false;
  const saveLabel = saved ? "შენახულიდან ამოღება" : "შენახულში დამატება";
  const compareLabel = compared ? "შედარებიდან ამოღება" : "შედარებაში დამატება";

  return <div className={css.group} data-compact={compact && showSave} data-choice-actions={productId}>
    <div className={css.controls}>
      {showSave && <button type="button" className={css.button} data-save-button="" disabled={!choices?.ready}
        aria-pressed={saved} aria-label={`${saveLabel} — ${productName}`}
        title={choices ? saveLabel : "შენახვა მიუწვდომელია წინასწარ ხედში"}
        onClick={() => {
          if (!choices) return;
          const result = choices.toggleSaved(productId);
          setNotice(result.ok ? null : { message: result.message, href: "/saved", label: "შენახულის ნახვა" });
        }}>
        <BookmarkIcon active={saved} /><span className={compact ? "sr-only" : undefined}>{saved ? "შენახულია" : "შენახვა"}</span>
      </button>}
      <button type="button" className={css.button} disabled={!choices?.ready}
        aria-pressed={compared} aria-label={`${compareLabel} — ${productName}`}
        title={choices ? compareLabel : "შედარება მიუწვდომელია წინასწარ ხედში"}
        aria-describedby={choices && notice ? noticeId : undefined}
        onClick={() => {
          if (!choices) return;
          const result = choices.toggleCompared(productId);
          setNotice(result.ok ? null : { message: result.message, href: "/compare", label: "შედარების ნახვა" });
        }}>
        <CompareIcon active={compared} /><span>შედარება</span>
      </button>
    </div>
    {choices && notice && <div className={css.notice} id={noticeId}>
      <p>{notice.message}</p><Link href={notice.href}>{notice.label}</Link>
    </div>}
    {choices && !compact && !choices.persistent && <p className={css.sessionHint}>ბრაუზერში შენახვა მიუწვდომელია. არჩევანი დროებით ინახება და გვერდის განახლებისას დაიკარგება.</p>}
  </div>;
}
