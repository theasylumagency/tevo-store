import type { Catalog } from "@/lib/catalog/types";
import { blockNames, inWindow, normalizeHome, type Block, type HomeDocument, type HomeTarget } from "./model";
import { homeEligible, homeSelection, resolveHomeTarget } from "./selection";

export interface HomeIssue { code: string; message: string; block?: Block | "intro" }
export interface HomeAssessment {
  errors: HomeIssue[];
  warnings: HomeIssue[];
  counts: { picks: number; seasonal: number; popular: number };
  offerAvailable: boolean;
}
export interface AssessmentOptions { media?: string[]; now?: number; sales?: string[] }

/** Same finite set of rules is used in previews, publication and timed activation. */
export function assessHome(input: HomeDocument, catalog: Catalog, options: AssessmentOptions = {}): HomeAssessment {
  const doc = normalizeHome(input);
  const active = doc.layouts[doc.preset];
  const view = homeSelection(doc, catalog.products, options.sales ?? [], inWindow(doc.offer.start, doc.offer.end, options.now ?? Date.now()));
  const errors: HomeIssue[] = [], warnings: HomeIssue[] = [];
  const required = (value: string, message: string, block: HomeIssue["block"]) => {
    if (!value.trim()) errors.push({ code: "required_text", block, message });
  };
  const checkTarget = (target: HomeTarget, block: "intro" | "advice", requiredLink: boolean) => {
    if (target.kind === "none") {
      if (requiredLink) errors.push({ code: "missing_target", block, message: "გზამკვლევისთვის აირჩიე შესაბამისი პროდუქტების გადასასვლელი." });
      return;
    }
    required(target.label, "გადასასვლელ ღილაკს დასახელება სჭირდება.", block);
    if (!resolveHomeTarget(target, catalog)) errors.push({ code: "unavailable_target", block,
      message: "არჩეული გადასასვლელი ამჟამად ხელმისაწვდომ პროდუქტებთან არ მიდის. შეცვალე დანიშნულება." });
  };
  if (!(doc.preset === "offer" && view.offer)) {
    required(doc.intro.title, "მთავარ გვერდს სათაური სჭირდება.", "intro");
    checkTarget(doc.intro.target, "intro", false);
  }
  required(doc.catalogTitle, "კატეგორიების სექციას სათაური სჭირდება.", "catalog");
  if (doc.categoryIds.length && doc.categoryIds.some(id => !catalog.categories.some(c => c.id === id && catalog.products.some(p => p.visible && p.category === id)))) {
    warnings.push({ code: "missing_categories", block: "catalog", message: "ზოგი გამორჩეული კატეგორია ამჟამად ცარიელია. თუ არცერთი დარჩა, გამოჩნდება მთელი კატალოგი." });
  }
  for (const key of ["picks", "seasonal"] as const) {
    if (!active.includes(key)) continue;
    const collection = doc[key], selected = view[key];
    if (selected.length) required(collection.title, "პროდუქტების შერჩევას სათაური სჭირდება.", key);
    else warnings.push({ code: "empty_collection", block: key,
      message: `${blockNames[key]} ცარიელია და საჯარო გვერდზე არ გამოჩნდება.` });
    if (collection.mode === "manual") {
      const missing = collection.ids.filter(id => !selected.some(p => p.id === id));
      if (missing.length) warnings.push({ code: "excluded_products", block: key,
        message: `არჩეული პროდუქტებიდან ${missing.length} არ გამოჩნდება — შეამოწმე ხელმისაწვდომობა, ფასი და შერჩევის პირობები.` });
    }
    const uncertain = selected.filter(p => p.availability.status === "confirm_with_store").length;
    if (uncertain) warnings.push({ code: "stock_unconfirmed", block: key,
      message: `${uncertain} პროდუქტის მარაგი დასაზუსტებელია. ბარათებზე ეს პირდაპირ გამოჩნდება.` });
    if (options.media && selected.some(p => !p.media.some(m => options.media!.includes(m.file)))) warnings.push({
      code: "missing_product_photos", block: key, message: "ზოგი პროდუქტის ფოტო ჯერ ხელმისაწვდომი არ არის. გამოჩნდება ფოტოს მოლოდინის აღნიშვნა.",
    });
  }
  if (active.includes("offer")) {
    if (!view.offer) {
      const issue: HomeIssue = { code: "offer_unavailable", block: "offer", message: "მთავარი შეთავაზებისთვის მოქმედი ფასდაკლების მქონე ხელმისაწვდომი პროდუქტი ვერ მოიძებნა." };
      (doc.preset === "offer" ? errors : warnings).push(issue);
    } else {
      required(doc.offer.title, "მთავარ შეთავაზებას სათაური სჭირდება.", "offer");
      if (view.offer.availability.status === "confirm_with_store") warnings.push({ code: "stock_unconfirmed", block: "offer",
        message: "შეთავაზების პროდუქტის მარაგი დასაზუსტებელია. ეს შეთავაზებაშიც გამოჩნდება." });
    }
  }
  if (active.includes("guide")) {
    const valid = doc.guide.tasks.filter(task => task.title.trim() && catalog.products.some(p => homeEligible(p) && p.product_type === task.type));
    if (!valid.length) (doc.preset === "guide" ? errors : warnings).push({ code: "empty_guide", block: "guide",
      message: "არჩევაში დახმარებისთვის დაამატე მინიმუმ ერთი დასახელებული ამოცანა შესაბამისი ხელმისაწვდომი პროდუქტებით." });
    else required(doc.guide.title, "არჩევაში დახმარების სექციას სათაური სჭირდება.", "guide");
    if (valid.length && valid.length < doc.guide.tasks.length) warnings.push({ code: "unavailable_tasks", block: "guide",
      message: "ზოგი ამოცანა დაუსრულებელია ან შესაბამისი პროდუქტი არ აქვს და არ გამოჩნდება." });
  }
  if (active.includes("advice")) {
    required(doc.advice.title, "რჩევას სათაური სჭირდება.", "advice");
    required(doc.advice.text, "დაწერე მოკლე რჩევა ან გზამკვლევი.", "advice");
    checkTarget(doc.advice.target, "advice", true);
  }
  if (active.includes("service") && doc.service.items.length) required(doc.service.title, "მომსახურების სექციას სათაური სჭირდება.", "service");
  if (active.includes("popular")) {
    if (view.popular.length) required(doc.popularTitle, "გაყიდვადი პროდუქტების სექციას სათაური სჭირდება.", "popular");
    else warnings.push({ code: "no_sales", block: "popular", message: "გაყიდვების მონაცემების გარეშე გამოჩნდება ჩვენი შერჩევა, შესაბამისი სახელწოდებით." });
  }
  const heroBlocks = ["intro", ...(active.includes("offer") ? ["offer"] : [])] as const;
  if (options.media) for (const key of heroBlocks) {
    const photo = doc[key as "intro" | "offer"];
    if ([photo.photo, photo.mobilePhoto].some(file => file && !options.media!.includes(file))) warnings.push({
      code: "missing_photo", block: key as "intro" | "offer", message: "არჩეული ფოტო ხელმისაწვდომი არ არის. გადაამოწმე მედიათეკა.",
    });
  }
  const copyBlocks: Array<[HomeIssue["block"], string]> = [["intro", doc.intro.title + " " + doc.intro.text]];
  if (active.includes("offer")) copyBlocks.push(["offer", doc.offer.title + " " + doc.offer.text]);
  for (const [block, copy] of copyBlocks) if (/\d[\d\s.,]*\s*(?:%|₾|ლარი)/.test(copy)) warnings.push({
    code: "numeric_promise", block, message: "ტექსტში თანხა ან პროცენტია მითითებული. ფასები ავტომატურად მოდის პროდუქტის ბარათიდან; გადაამოწმე, რომ ტექსტიც მოქმედ შეთავაზებას შეესაბამება.",
  });
  return { errors, warnings, counts: { picks: view.picks.length, seasonal: view.seasonal.length, popular: view.popular.length }, offerAvailable: !!view.offer };
}

export function summarizeHomeChanges(beforeInput: HomeDocument, afterInput: HomeDocument): string[] {
  const before = normalizeHome(beforeInput), after = normalizeHome(afterInput);
  const changes: string[] = [];
  if (before.preset !== after.preset) changes.push("შეიცვალა მთავარი გვერდის კომპოზიცია");
  if (JSON.stringify(before.layouts) !== JSON.stringify(after.layouts)) changes.push("შეიცვალა ბლოკების ჩართვა ან თანმიმდევრობა");
  const fields: Array<[keyof HomeDocument, string]> = [
    ["intro", "შეიცვალა შესავალი"], ["catalogTitle", "შეიცვალა კატეგორიების სათაური"],
    ["categoryIds", "შეიცვალა გამორჩეული კატეგორიები"], ["offer", "შეიცვალა მთავარი შეთავაზება"],
    ["picks", "შეიცვალა ჩვენი შერჩევა"], ["seasonal", "შეიცვალა სეზონური შერჩევა"],
    ["guide", "შეიცვალა არჩევაში დახმარება"], ["advice", "შეიცვალა რჩევა"],
    ["service", "შეიცვალა მომსახურების ბლოკი"], ["popularTitle", "შეიცვალა გაყიდვადი პროდუქტების სათაური"],
  ];
  for (const [key, label] of fields) if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) changes.push(label);
  return changes;
}
