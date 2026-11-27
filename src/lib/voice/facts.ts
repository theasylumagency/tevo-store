import { createHash } from "node:crypto";
import type { Product } from "@/lib/catalog/types";
import type { Evidence, Paragraph } from "./model";

export function factsFor(p: Product, typeName: string) {
  const facts: Evidence[] = [];
  function add(label: string, value?: string | null) {
    if (value?.trim()) facts.push({ label, value: value.trim() });
  }
  add("სახელი", p.name);
  add("ტიპი", typeName);
  add("მოდელი", p.model);
  add("ბრენდი", p.brand);
  for (const feature of p.features) add("თავისებურება", feature);
  for (const spec of p.specs) add(spec.label, [spec.value, spec.unit].filter(Boolean).join(" "));
  add("თავსებადობა", p.compatibility?.note);
  return facts;
}
export function fingerprint(facts: Evidence[]) {
  return createHash("sha256").update(JSON.stringify(facts)).digest("hex");
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
  return [...new Set(paragraphs.flatMap(p => {
    const cited = p.sources.map(id => facts[id - 1]);
    if (!cited.length || cited.some(f => !f)) return ["აბზაცს აკლია მოქმედი მითითება წყაროზე."];
    return warnings(p.text, cited);
  }))];
}
