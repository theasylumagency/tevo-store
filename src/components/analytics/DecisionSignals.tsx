"use client";

import { useEffect, useRef } from "react";
import { isDecisionEvent, type DecisionEvent } from "@/lib/analytics/model";
import { analyticsAllowed, reportDecisionEvent } from "@/lib/analytics/client";

/** Once per mounted view / signal, only while the document is visible. No
 * persistent deduplication or identity, and no event during a server prefetch. */
export function useDecisionSignals(events: readonly DecisionEvent[]) {
  const reported = useRef(new Set<DecisionEvent>());
  const key = events.join("|");
  useEffect(() => {
    if (!key) return;
    const send = () => {
      if (document.visibilityState !== "visible" || !analyticsAllowed()) return;
      for (const event of key.split("|")) {
        if (!isDecisionEvent(event) || reported.current.has(event)) continue;
        reported.current.add(event);
        void reportDecisionEvent(event);
      }
    };
    const timer = window.setTimeout(send, 0);
    document.addEventListener("visibilitychange", send);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", send);
    };
  }, [key]);
}
export function DecisionSignals({ events }: { events: DecisionEvent[] }) {
  useDecisionSignals(events);
  return null;
}
