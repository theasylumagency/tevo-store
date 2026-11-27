"use client";

import { useEffect, useRef, type ReactNode } from "react";

function report(event: "open" | "exposed", day?: string) {
  const headers = new Headers({ "X-Description-Event": event });
  if (day) headers.set("X-Description-Day", day);
  return fetch("/api/storefront/description-views", {
    method: "POST", headers, credentials: "omit", referrerPolicy: "origin", keepalive: true,
  });
}

/** Only the beginning of the description is observed. The request contains no product or visitor ID. */
export function DescriptionVisibility({ children }: { children: ReactNode }) {
  const firstLine = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const target = firstLine.current;
    if (!target || !window.IntersectionObserver || navigator.doNotTrack === "1" ||
      ("globalPrivacyControl" in navigator && navigator.globalPrivacyControl === true)) return;
    let opening: Promise<string | null> | undefined;
    let visible = false, reported = false;
    let timer: ReturnType<typeof setTimeout>;

    function update() {
      clearTimeout(timer);
      if (document.visibilityState !== "visible" || reported) return;
      opening ??= report("open").then(r => r.ok ? r.text() : null).catch(() => null);
      if (visible) timer = setTimeout(() => {
        if (document.visibilityState !== "visible") return;
        reported = true;
        void opening?.then(async day => { if (day) await report("exposed", day); }).catch(() => {});
      }, 3000);
    }

    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        visible = entry.isIntersecting && entry.intersectionRatio >= 1;
        update();
      }
    }, { threshold: [0, 1] });
    observer.observe(target);
    // Defer the opening so a discarded React mount cannot add a second page view.
    const start = setTimeout(update, 0);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearTimeout(start);
      clearTimeout(timer);
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return <div className="relative">
    <span aria-hidden="true" ref={firstLine} className="pointer-events-none absolute start-0 top-0 h-[1em] w-px" />
    {children}
  </div>;
}
