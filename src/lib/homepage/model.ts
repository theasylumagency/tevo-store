import { t } from "@/i18n";

export const presetNames = {
  catalog: "კატალოგი პირველ რიგში", offer: "შეთავაზება პირველ რიგში", guide: "არჩევანში დახმარება",
};
export const blockNames = {
  catalog: "კატეგორიები", offer: "მთავარი შეთავაზება", guide: "არჩევანში დახმარება",
  picks: "ჩვენი შერჩევა", seasonal: "სეზონური შერჩევა", popular: "ყველაზე გაყიდვადი",
  advice: "რჩევა და გზამკვლევი", service: "მომსახურება და დახმარება",
};
export type Preset = keyof typeof presetNames;
export type Block = keyof typeof blockNames;
export const presets = Object.keys(presetNames) as Preset[];
export const blocks = Object.keys(blockNames) as Block[];

export const presetSummaries: Record<Preset, string> = {
  catalog: "პროდუქტის ჯგუფის სწრაფად პოვნა ყოველდღიურ სამუშაო რეჟიმში.",
  offer: "ერთი მოქმედი შეთავაზებისა და მისი პროდუქტების გამორჩევა.",
  guide: "პროდუქტის შერჩევა გასაკეთებელი სამუშაოს მიხედვით.",
};
export const collectionSortNames = {
  recommended: "კატალოგის რიგი", price_asc: "დაბალი ფასი პირველად",
  price_desc: "მაღალი ფასი პირველად", offers: "მხოლოდ მოქმედი შეთავაზებები",
};
export const serviceNames = {
  delivery: "მიწოდება", warranty: "საგარანტიო პირობები", payment: "გადახდის გზები", contact: "კონსულტაცია",
};
export type ServiceItem = keyof typeof serviceNames;
export interface HomeTarget {
  kind: "none" | "catalog" | "category" | "type" | "product";
  value: string;
  label: string;
}
export interface HomeCollection {
  title: string; text: string; mode: "type" | "manual"; type: string; ids: string[];
  limit: 4 | 8; sort: keyof typeof collectionSortNames; onlyInStock: boolean;
}
export interface HomePhoto {
  photo: string; mobilePhoto: string; focalX: number; focalY: number;
}

export interface HomeDocument {
  preset: Preset;
  layouts: Record<Preset, Block[]>;
  intro: HomePhoto & { title: string; text: string; target: HomeTarget };
  catalogTitle: string;
  categoryIds: string[];
  offer: HomePhoto & { title: string; text: string; product: string; start: string; end: string; fallback: "hide" | "picks" };
  guide: { title: string; tasks: { title: string; text: string; type: string }[] };
  picks: HomeCollection;
  seasonal: HomeCollection;
  advice: { title: string; text: string; target: HomeTarget };
  service: { title: string; items: ServiceItem[] };
  popularTitle: string;
}

export function initialHome(): HomeDocument {
  return {
    preset: "catalog",
    layouts: { catalog: ["catalog", "picks"], offer: ["offer", "catalog", "picks"], guide: ["guide", "catalog", "picks"] },
    intro: { title: t("home.title"), text: t("home.lead"), photo: "", mobilePhoto: "", focalX: 50, focalY: 50,
      target: { kind: "none", value: "", label: "კატალოგის ნახვა" } },
    catalogTitle: t("home.categories"),
    categoryIds: [],
    offer: { title: blockNames.offer, text: "", photo: "", mobilePhoto: "", focalX: 50, focalY: 50,
      product: "", start: "", end: "", fallback: "picks" },
    guide: { title: "რა სამუშაოს გეგმავ?", tasks: [
      { title: "ნიადაგის დამუშავება", text: "შეარჩიე მოტობლოკი ნაკვეთისთვის.", type: "MOTOBLOCK" },
      { title: "ბალახის გაკრეჭა", text: "შეადარე ბალახის საკრეჭები.", type: "BRUSHCUTTER" },
      { title: "წყლის გადატუმბვა", text: "მოძებნე სამუშაოს შესაბამისი ტუმბო.", type: "WATER_PUMP" },
    ] },
    picks: { title: t("home.featured"), text: "", mode: "type", type: "MOTOBLOCK", ids: [], limit: 8, sort: "recommended", onlyInStock: false },
    seasonal: { title: "სეზონური შერჩევა", text: "", mode: "manual", type: "", ids: [], limit: 4, sort: "recommended", onlyInStock: false },
    advice: { title: "დახმარება არჩევაში", text: "", target: { kind: "none", value: "", label: "შესაბამისი პროდუქტების ნახვა" } },
    service: { title: "შეძენა და დახმარება", items: ["delivery", "warranty", "contact"] },
    popularTitle: blockNames.popular,
  };
}

/** Add fields to older stored documents without discarding their content or layout order. */
export function normalizeHome(input: unknown): HomeDocument {
  const source = (input && typeof input === "object" && !Array.isArray(input) ? input : {}) as Partial<HomeDocument>;
  const base = initialHome();
  return {
    ...base, ...source,
    layouts: { ...base.layouts, ...source.layouts },
    intro: { ...base.intro, ...source.intro, target: { ...base.intro.target, ...source.intro?.target } },
    offer: { ...base.offer, ...source.offer },
    guide: { ...base.guide, ...source.guide },
    picks: { ...base.picks, ...source.picks },
    seasonal: { ...base.seasonal, ...source.seasonal },
    advice: { ...base.advice, ...source.advice, target: { ...base.advice.target, ...source.advice?.target } },
    service: { ...base.service, ...source.service },
  };
}

// Admin inputs are wall-clock times in Tbilisi (UTC+04:00).
export function localTime(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return NaN;
  const ms = Date.parse(value + ":00+04:00");
  return Number.isFinite(ms) && new Date(ms + 4 * 3600000).toISOString().slice(0, 16) === value ? ms : NaN;
}

export interface HomeSchedule { start: string; end: string; document: HomeDocument }
export interface HomePublication { published: HomeDocument; schedule: HomeSchedule | null }

export function inWindow(start: string, end: string, now: number) {
  return (!start || localTime(start) <= now) && (!end || now < localTime(end));
}

export function effectiveHome({ published, schedule }: HomePublication, now: number) {
  return normalizeHome(schedule && inWindow(schedule.start, schedule.end, now) ? schedule.document : published);
}
