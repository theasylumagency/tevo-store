"use client";

import Link from "next/link";
import { useTransition } from "react";
import ui from "@/components/storefront/foundation.module.css";

/** Retry the current screen without changing the stored cart or exposing error details. */
export default function StoreError({ retry }: { error: unknown; retry: () => void }) {
  const [pending, startTransition] = useTransition();
  return <div className={ui.state} role="alert">
    <h1 className={ui.pageTitle}>გვერდი ვერ ჩაიტვირთა</h1>
    <p className={ui.stateCopy}>კავშირი შესაძლოა დროებით შეფერხდა. სცადე გვერდის ხელახლა ჩატვირთვა.</p>
    <div className={ui.actions}>
      <button type="button" className={ui.primaryAction} disabled={pending} onClick={() => startTransition(() => retry())}>
        {pending ? "იტვირთება…" : "ხელახლა ცდა"}
      </button>
      <Link href="/" className={ui.quietAction}>მთავარზე დაბრუნება</Link>
    </div>
  </div>;
}
