import type { DecisionEvent } from "./model";

const preferenceKey = "store:statistics-disabled";
const preferenceEvent = "store-statistics-preference";
export type AnalyticsPreference = "enabled" | "disabled" | "browser" | "unavailable" | "loading";
export function analyticsPreference(): AnalyticsPreference {
  if (typeof window === "undefined") return "loading";
  if (navigator.doNotTrack === "1" || ("globalPrivacyControl" in navigator && navigator.globalPrivacyControl === true)) return "browser";
  try { return window.localStorage.getItem(preferenceKey) === "1" ? "disabled" : "enabled"; }
  catch { return "unavailable"; }
}
export const analyticsAllowed = () => analyticsPreference() === "enabled";
export function setAnalyticsPreference(enabled: boolean) {
  try {
    if (enabled) window.localStorage.removeItem(preferenceKey);
    else window.localStorage.setItem(preferenceKey, "1");
    window.dispatchEvent(new Event(preferenceEvent));
  } catch { /* fail closed if storage is unavailable */ }
}
export function subscribeAnalyticsPreference(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(preferenceEvent, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(preferenceEvent, listener);
  };
}
export async function reportDecisionEvent(event: DecisionEvent): Promise<boolean> {
  if (!analyticsAllowed()) return false;
  try {
    const response = await fetch("/api/storefront/decision-events", {
      method: "POST", headers: { "X-Decision-Event": event },
      credentials: "omit", referrerPolicy: "origin", keepalive: true,
    });
    return response.ok;
  } catch { return false; }
}
