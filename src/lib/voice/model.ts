export interface VoiceProfile { tone: string; avoid: string; example: string }
export const defaultProfile: VoiceProfile = {
  tone: "ბუნებრივი, მკაფიო ქართული. მყიდველს მოკლედ აუხსენი პროდუქტის დანიშნულება და პრაქტიკული თავისებურებები.",
  avoid: "გადაჭარბებული დაპირებები, დაუსაბუთებელი უპირატესობები და ზედმეტი ტექნიკური ჟარგონი.",
  example: "",
};
export const scopes = { pilot: "საცდელი ჯგუფი · 10-მდე", selected: "ჩემი შერჩევა", new: "ჯერ დაუმუშავებელი",
  changed: "შეცვლილი წყარო", all: "ყველა დაშვებული პროდუქტი" };
export type Scope = keyof typeof scopes;

interface Candidate { id: string; blocked: string; fresh: boolean; changed: boolean }
export function chooseProducts<T extends Candidate>(products: T[], scope: Scope, ids: string[]) {
  const selected = new Set(ids);
  const eligible = products.filter(p => !p.blocked);
  switch (scope) {
    case "pilot": return eligible.slice(0, 10);
    case "selected": return eligible.filter(p => selected.has(p.id));
    case "new": return eligible.filter(p => p.fresh);
    case "changed": return eligible.filter(p => p.changed);
    case "all": return eligible;
  }
}
export const statuses = { queued: "რიგშია", working: "მუშავდება", review: "გადასახედია", approved: "დამტკიცებულია",
  published: "გამოქვეყნებულია", failed: "ვერ მომზადდა", stale: "პროდუქტი შეიცვალა", rejected: "უარყოფილია" };
export type VoiceStatus = keyof typeof statuses;
export interface Evidence { label: string; value: string }
export interface Paragraph { text: string; sources: number[] }
export class VoiceError extends Error {}
