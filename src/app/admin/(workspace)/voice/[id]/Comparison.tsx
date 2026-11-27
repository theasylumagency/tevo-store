import { diffWordsWithSpace } from "diff";

export function Comparison({ before, after }: { before: string; after: string }) {
  const parts = diffWordsWithSpace(before, after, { timeout: 50 });
  return <div className="grid gap-4 md:grid-cols-2">
    <div><h3 className="mb-1 text-sm font-semibold">არსებული აღწერა</h3><p className="whitespace-pre-line text-sm text-ink-2">{!before ? "აღწერა ცარიელია" :
      parts ? parts.map((x,i) => x.added ? null : x.removed ? <del className="bg-warn-soft" key={i}>{x.value}</del> : x.value) : before}</p></div>
    <div><h3 className="mb-1 text-sm font-semibold">შემოთავაზებული აღწერა</h3><p className="whitespace-pre-line text-sm">{
      parts ? parts.map((x,i) => x.removed ? null : x.added ? <ins className="bg-accent-soft no-underline" key={i}>{x.value}</ins> : x.value) : after}</p></div>
  </div>;
}
