"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { analyticsAllowed, reportDecisionEvent, subscribeAnalyticsPreference } from "@/lib/analytics/client";
import { feedbackEvent, type FeedbackArea, type FeedbackAnswer } from "@/lib/analytics/model";

const questions: Record<FeedbackArea, string> = {
  search: "ძიებამ დაგეხმარა საჭირო ინფორმაციის პოვნაში?",
  compare: "შედარება დაგეხმარა არჩევანის გაკეთებაში?",
  product: "ამ პროდუქტზე საკმარისი ინფორმაცია მიიღე გადაწყვეტილებისთვის?",
  task: "სამუშაოს მიხედვით არჩევა დაგეხმარა შემდეგი ნაბიჯის განსაზღვრაში?",
};
const answers: { value: FeedbackAnswer; label: string }[] = [
  { value: "yes", label: "კი" }, { value: "partly", label: "ნაწილობრივ" }, { value: "no", label: "არა" },
];
export function DecisionFeedback({ area }: { area: FeedbackArea }) {
  const enabled = useSyncExternalStore(subscribeAnalyticsPreference, analyticsAllowed, () => false);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const busy = useRef(false);
  async function answer(value: FeedbackAnswer) {
    if (busy.current || state === "sent") return;
    busy.current = true;
    setState("sending");
    const ok = await reportDecisionEvent(feedbackEvent(area, value));
    setState(ok ? "sent" : "error");
    busy.current = false;
  }
  if (!enabled) return null;
  return <section className="my-4 space-y-2 rounded-card border border-line bg-surface p-3 text-sm" aria-label={questions[area]} data-testid={area + "-decision-feedback"}>
    <p className="font-medium">{questions[area]}</p>
    {state === "sent" ? <p role="status" className="text-ink-2">მადლობა, პასუხი დაგვეხმარება მაღაზიის გაუმჯობესებაში.</p> : <>
      <div className="flex flex-wrap gap-2">
        {answers.map(a => <button key={a.value} type="button" disabled={state === "sending"} onClick={() => { void answer(a.value); }}
          className="min-h-11 rounded-lg border border-line px-3 py-2 hover:bg-bg disabled:opacity-50" data-answer={a.value}>{a.label}</button>)}
      </div>
      <p className="text-xs text-ink-2">არასავალდებულო · მხოლოდ დღიურ სტატისტიკაში ითვლება.</p>
      {state === "error" && <p role="status">პასუხი ვერ ჩაითვალა. შეგიძლია ხელახლა სცადო.</p>}
    </>}
  </section>;
}
