import type { Catalog } from "@/lib/catalog/types";
import { inWindow, normalizeHome, type HomePublication } from "./model";
import { assessHome } from "./policy";

/** Re-evaluate timed promises against the store's current published catalog. */
export function resolveHomePublication(publication: HomePublication, catalog: Catalog, now: number) {
  const base = normalizeHome(publication.published);
  const schedule = publication.schedule;
  if (schedule && inWindow(schedule.start, schedule.end, now)) {
    const candidate = normalizeHome(schedule.document);
    const assessment = assessHome(candidate, catalog, { now });
    if (!assessment.errors.length) return { document: candidate, source: schedule.end ? "campaign" as const : "base" as const, blocked: false, errors: [] };
    return { document: base, source: "base" as const, blocked: true, errors: assessment.errors };
  }
  return { document: base, source: "base" as const, blocked: false, errors: [] };
}
