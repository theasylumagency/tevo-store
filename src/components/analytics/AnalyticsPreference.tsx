"use client";

import { useSyncExternalStore } from "react";
import { analyticsPreference, setAnalyticsPreference, subscribeAnalyticsPreference, type AnalyticsPreference } from "@/lib/analytics/client";

const labels: Record<AnalyticsPreference, string> = {
  enabled: "დღიური სტატისტიკა ჩართულია.",
  disabled: "დღიური სტატისტიკა გამორთულია ამ ბრაუზერში.",
  browser: "სტატისტიკა გამორთულია ბრაუზერის კონფიდენციალურობის პარამეტრით.",
  unavailable: "სტატისტიკა გამორთულია, რადგან ბრაუზერში პარამეტრის შენახვა ვერ ხერხდება.",
  loading: "პარამეტრი იტვირთება…",
};
export function AnalyticsPreferenceControl() {
  const state = useSyncExternalStore(subscribeAnalyticsPreference, analyticsPreference, () => "loading" as const);
  return <section className="mt-6 space-y-3 rounded-card border border-line bg-surface p-4" aria-label="სტატისტიკის პარამეტრი">
    <h2 className="font-semibold">მაღაზიის გაუმჯობესების სტატისტიკა</h2>
    <p className="text-sm" role="status">{labels[state]}</p>
    {(state === "enabled" || state === "disabled") && <button type="button" data-testid="analytics-preference"
      className="rounded-card border border-line px-3 py-2 text-sm" onClick={() => setAnalyticsPreference(state !== "enabled")}>
      {state === "enabled" ? "სტატისტიკის გამორთვა" : "სტატისტიკის ჩართვა"}
    </button>}
    <p className="text-xs text-ink-2">არჩევანი ინახება მხოლოდ ამ ბრაუზერში; მაღაზიის ფუნქციებს არ ცვლის.</p>
  </section>;
}
