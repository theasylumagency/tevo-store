import { normalizeHome, type HomeDocument } from "@/lib/homepage/model";
import { parseHome } from "@/lib/homepage/validation";

export type HomeRecovery = {
  owner: string; revision: number; document: HomeDocument; updatedAt: string;
};

// A deployment hosts one store. sessionStorage additionally isolates each browser tab.
const storageKey = () => "homepage-draft:v1:" + window.location.origin + ":/admin/homepage";

export function readHomeRecovery(): HomeRecovery | null {
  try {
    const text = window.sessionStorage.getItem(storageKey());
    if (!text || text.length > 200_000) return null;
    const value = JSON.parse(text) as HomeRecovery;
    if (typeof value.owner !== "string" || !Number.isSafeInteger(value.revision) || value.revision < 0 ||
      typeof value.updatedAt !== "string" || !Number.isFinite(Date.parse(value.updatedAt))) return null;
    const document = normalizeHome(value.document);
    if (typeof document.offer.start !== "string" || typeof document.offer.end !== "string") return null;
    // An unfinished date range must remain recoverable even when it cannot yet be saved.
    parseHome({ ...document, offer: { ...document.offer, start: "", end: "" } });
    return { ...value, document };
  } catch { return null; }
}

export function writeHomeRecovery(value: HomeRecovery): boolean {
  try { window.sessionStorage.setItem(storageKey(), JSON.stringify(value)); return true; }
  catch { return false; }
}

export function clearHomeRecovery(owner: string) {
  try {
    const text = window.sessionStorage.getItem(storageKey());
    if (text && JSON.parse(text).owner === owner) window.sessionStorage.removeItem(storageKey());
  } catch { /* A restricted storage area must not prevent normal server saving. */ }
}
