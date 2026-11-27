"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { useChoices } from "./ChoiceProvider";
import css from "./saved.module.css";

function ChoiceLinkContent({ pathname }: { pathname?: string }) {
  const { ready, savedIds, comparedIds, persistent } = useChoices();
  return <div className={css.shortcuts}>
    <nav aria-label="არჩევანის ინსტრუმენტები" className={css.shortcutLinks}>
      <Link href="/saved" aria-current={pathname === "/saved" ? "page" : undefined}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4z" /></svg>
        <span>შენახული</span><span className={css.count}>{ready ? savedIds.length : 0}</span>
      </Link>
      <Link href="/compare" aria-current={pathname === "/compare" ? "page" : undefined}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 3v18M5 7h14M5 7l-3 7h6L5 7Zm14 0-3 7h6l-3-7ZM7 21h10" /></svg>
        <span>შედარება</span><span className={css.count}>{ready ? comparedIds.length : 0}</span>
      </Link>
    </nav>
    {ready && !persistent && <p className={css.storageNote} role="status">არჩევანი დროებით ინახება; განახლების ან დახურვისას წაიშლება.</p>}
  </div>;
}

function ActiveChoiceLinks() {
  const pathname = usePathname();
  return <ChoiceLinkContent pathname={pathname} />;
}

export function ChoiceLinks() {
  return <Suspense fallback={<ChoiceLinkContent />}><ActiveChoiceLinks /></Suspense>;
}
