import { t } from "@/i18n";

export const presetNames = {
  catalog: "კატალოგი პირველ რიგში", offer: "შეთავაზება პირველ რიგში", guide: "არჩევანში დახმარება",
};
export const blockNames = {
  catalog: "კატეგორიები", offer: "დღის შეთავაზება", guide: "არჩევანში დახმარება",
  picks: "ჩვენი შერჩევა", popular: "ყველაზე გაყიდვადი",
};
export type Preset = keyof typeof presetNames;
export type Block = keyof typeof blockNames;
export const presets = Object.keys(presetNames) as Preset[];
export const blocks = Object.keys(blockNames) as Block[];

export interface HomeDocument {
  preset: Preset;
  layouts: Record<Preset, Block[]>;
  intro: { title: string; text: string; photo: string };
  catalogTitle: string;
  offer: { title: string; text: string; photo: string; product: string; start: string; end: string; fallback: "hide" | "picks" };
  guide: { title: string; tasks: { title: string; text: string; type: string }[] };
  picks: { title: string; text: string; mode: "type" | "manual"; type: string; ids: string[] };
  popularTitle: string;
}

export function initialHome(): HomeDocument {
  return {
    preset: "catalog",
    layouts: { catalog: ["catalog", "picks"], offer: ["offer", "catalog", "picks"], guide: ["guide", "catalog", "picks"] },
    intro: { title: t("home.title"), text: t("home.lead"), photo: "" },
    catalogTitle: t("home.categories"),
    offer: { title: blockNames.offer, text: "", photo: "", product: "", start: "", end: "", fallback: "picks" },
    guide: { title: "რა სამუშაოს გეგმავ?", tasks: [
      { title: "ნიადაგის დამუშავება", text: "შეარჩიე მოტობლოკი ნაკვეთისთვის.", type: "MOTOBLOCK" },
      { title: "ბალახის გაკრეჭა", text: "შეადარე ბალახის საკრეჭები.", type: "BRUSHCUTTER" },
      { title: "წყლის გადატუმბვა", text: "მოძებნე სამუშაოს შესაბამისი ტუმბო.", type: "WATER_PUMP" },
    ] },
    picks: { title: t("home.featured"), text: "", mode: "type", type: "MOTOBLOCK", ids: [] },
    popularTitle: blockNames.popular,
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
  return schedule && inWindow(schedule.start, schedule.end, now) ? schedule.document : published;
}
