import { createHash } from "node:crypto";
import type { Catalog, Product } from "@/lib/catalog/types";
import type { Evidence, FactRole, Paragraph } from "./model";

type FactContext = Pick<Catalog, "product_types" | "brands" | "attribute_vocabulary">;

// Sales copy must not use these until the catalog stores how each value was verified.
const unverifiedSalesFact = (key: string, label: string) =>
  /^warranty|^manufacture_date$|sherev|shemadgenlobis-koepitsienti/u.test(key) || /გარანტი|დამზადების|შერევ|შემადგენლობის კოეფიციენტ/u.test(label);

export function factsFor(p: Product, catalog: FactContext) {
  const facts: Evidence[] = [];
  function add(label: string, value?: string | null) {
    if (value?.trim()) facts.push({ label, value: value.trim() });
  }
  const brand = catalog.brands.find(b => b.id === p.brand);
  add("სახელი", p.name);
  add("ტიპი", catalog.product_types.find(t => t.id === p.product_type)?.name ?? p.product_type);
  add("მოდელი", p.model);
  add("ბრენდი", brand?.name ?? p.brand);
  for (const feature of p.features) add("თავისებურება", feature);
  // Store filter attributes are the comparison dimensions buyers use. A false flag may only mean
  // "not recorded", so only stated values and true flags become evidence.
  const features = p.features.join(" ").toLowerCase();
  for (const [key, value] of Object.entries(p.attributes ?? {})) {
    const def = catalog.attribute_vocabulary[key];
    if (!def || value === false || value === "") continue;
    const text = value === true ? "აქვს" : String(value);
    if (value !== true && features.includes(text.toLowerCase())) continue;
    add(def.label, text);
  }
  for (const spec of p.specs) {
    if (unverifiedSalesFact(spec.key, spec.label)) continue;
    // The product's own model field is authoritative; a second "model" spec only adds conflicts.
    if (spec.key === "model" && p.model) continue;
    add(spec.label, [spec.value, spec.unit].filter(Boolean).join(" "));
  }
  add("თავსებადობა", p.compatibility?.note);
  return facts;
}
export function fingerprint(facts: Evidence[]) {
  return createHash("sha256").update(JSON.stringify(facts)).digest("hex");
}

const notCompared = new Set(["სახელი", "მოდელი", "ტიპი"]);
const norm = (s: string) => s.toLowerCase().replace(/\s+/gu, " ").trim();
const parts = (s: string) => norm(s).split(/\s*,\s*|\s+და\s+/u).filter(Boolean);

/**
 * Compare each fact with same-type products in the same request.
 * same: every peer that states this property states the same value.
 * differs: at least one peer states a different value (or lacks a stated feature).
 * unique: no peer states this property; that is missing data, not proof the peer lacks it.
 */
export function factRoles(products: { sku: string; facts: Evidence[] }[]) {
  const typeOf = (facts: Evidence[]) => facts.find(f => f.label === "ტიპი")?.value ?? "";
  const byLabel = (facts: Evidence[]) => {
    const map = new Map<string, Set<string>>();
    for (const f of facts) map.set(f.label, (map.get(f.label) ?? new Set()).add(norm(f.value)));
    return map;
  };
  const featureParts = (facts: Evidence[]) => new Set(facts.filter(f => f.label === "თავისებურება").flatMap(f => parts(f.value)));
  const indexed = products.map(p => ({ ...p, type: typeOf(p.facts), labels: byLabel(p.facts), features: featureParts(p.facts) }));
  return new Map(indexed.map(p => {
    const peers = indexed.filter(o => o.sku !== p.sku && o.type === p.type);
    const roles: (FactRole | undefined)[] = p.facts.map(f => {
      if (!peers.length || notCompared.has(f.label)) return undefined;
      if (f.label === "თავისებურება") {
        return parts(f.value).every(part => peers.every(o => o.features.has(part))) ? "same" : "differs";
      }
      const mine = p.labels.get(f.label)!;
      const stated = peers.map(o => o.labels.get(f.label)).filter((v): v is Set<string> => !!v);
      if (!stated.length) return "unique";
      return stated.every(v => v.size === mine.size && [...v].every(x => mine.has(x))) ? "same" : "differs";
    });
    return [p.sku, roles];
  }));
}

function numbers(s: string) { return (s.match(/\d+(?:[.,]\d+)*/g) ?? []).map(v => v.replaceAll(",", ".")); }

export function warnings(text: string, facts: Evidence[]) {
  const known = new Set(facts.flatMap(f => numbers(f.value)));
  const unknown = [...new Set(numbers(text).filter(n => !known.has(n)))];
  const issues: string[] = [];
  if (unknown.length) issues.push("წყაროში არ ჩანს რიცხვი · " + unknown.join(", "));
  if (/გარანტი|უფასო|ფასდაკლებ|ლარად|₾|https?:\/\/|<\/?[a-z]/iu.test(text)) issues.push("შეამოწმე სავაჭრო დაპირება, ბმული ან ფორმატირება.");
  if (/თავსებად|ერგება|მოერგება/u.test(text) && !facts.some(f => f.label === "თავსებადობა")) issues.push("წყაროში თავსებადობა დადასტურებული არ არის.");
  if (!/[ა-ჰ]/u.test(text)) issues.push("მაღაზიის აღწერის ენა ქართულია.");
  return issues;
}
export function paragraphWarnings(paragraphs: Paragraph[], facts: Evidence[]) {
  const issues = paragraphs.flatMap(p => {
    const cited = p.sources.map(id => facts[id - 1]);
    if (!cited.length || cited.some(f => !f)) return ["აბზაცს აკლია მოქმედი მითითება წყაროზე."];
    return warnings(p.text, cited);
  });
  const features = facts.flatMap((f, i) => f.label === "თავისებურება" ? [i + 1] : []);
  if (features.length && !paragraphs.some(p => p.sources.some(id => features.includes(id))))
    issues.push("აღწერაში არ ჩანს პროდუქტის თავისებურება.");
  // A soft flag, not an approval blocker: the editor may keep a word the facts justify.
  if (paragraphs.some(p => /იდეალურ|საიმედო|უმაღლესი ხარისხ|საუკეთესო|შესანიშნავ|სრულყოფილ/u.test(p.text)))
    issues.push("შეამოწმე შემფასებელი ეპითეტი — ფაქტით ჩანაცვლება სჯობს.");
  return [...new Set(issues)];
}
