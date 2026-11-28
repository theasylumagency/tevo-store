import { diffArrays } from "diff";

// jsdiff's word tokenizer only knows Latin letters, so Georgian text was compared letter by
// letter. Intl.Segmenter splits Georgian words correctly; whitespace and punctuation stay tokens.
const segmenter = new Intl.Segmenter("ka", { granularity: "word" });
const tokens = (s: string) => [...segmenter.segment(s)].map(x => x.segment);

/** diff=false shows two independent texts side by side (e.g. legacy copy vs a new draft). */
export function Comparison({ before, after, beforeLabel = "არსებული აღწერა", afterLabel = "შემოთავაზებული აღწერა", diff = false }: {
  before: string; after: string; beforeLabel?: string; afterLabel?: string; diff?: boolean;
}) {
  const parts = diff && before ? diffArrays(tokens(before), tokens(after), { timeout: 50 }) : undefined;
  return <div className="grid gap-4 md:grid-cols-2">
    <div><h3 className="mb-1 text-sm font-semibold">{beforeLabel}</h3><p className="whitespace-pre-line text-sm text-ink-2">{!before ? "აღწერა ცარიელია" :
      parts ? parts.map((x,i) => x.added ? null : x.removed ? <del className="bg-warn-soft" key={i}>{x.value.join("")}</del> : x.value.join("")) : before}</p></div>
    <div><h3 className="mb-1 text-sm font-semibold">{afterLabel}</h3><p className="whitespace-pre-line text-sm">{
      parts ? parts.map((x,i) => x.removed ? null : x.added ? <ins className="bg-accent-soft no-underline" key={i}>{x.value.join("")}</ins> : x.value.join("")) : after}</p></div>
  </div>;
}
