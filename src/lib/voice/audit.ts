// Surface repeated editorial advice while allowing shared factual specifications.
export function repeatedAdvice(items: { productId: string; proposal: string | null }[]) {
  const found = new Map<string, { sentence: string; skus: Set<string> }>();
  for (const item of items) {
    for (const fragment of (item.proposal ?? "").split(/(?<=[.!?])\s+|\n+/u)) {
      if (!/შეადარ|გაითვალისწინ|დააკვირდ|შეამოწმ|შერჩევისას|არჩევისას|ყურადღება მიაქცი/u.test(fragment)) continue;
      const sentence = fragment.trim();
      const key = /შეადარ/u.test(sentence) && /ზოლ/u.test(sentence) ? "compare-strip"
        : sentence.toLowerCase().replace(/[\p{P}\p{N}]/gu, "").replace(/\s+/gu, " ").trim();
      const entry = found.get(key) ?? { sentence, skus: new Set<string>() };
      entry.skus.add(item.productId);
      found.set(key, entry);
    }
  }
  return [...found.values()].filter(v => v.skus.size >= 2).map(v => ({ sentence: v.sentence, skus: [...v.skus] }));
}

// Distinctive words from structured construction/feature fields only. Match a
// Georgian inflectional stem, and never flag a feature already in this SKU's evidence.
export function borrowedFeatures(items: { productId: string; facts: {label: string; value: string}[]; proposal: string | null }[]) {
  const stems = (s: string) => (s.toLowerCase().match(/[ა-ჰ]{5,}/gu) ?? []).map(w => w.replace(/(?:ებით|ებითა|იანი|ით|ის|ები|ი)$/u, ""));
  const dictionary = new Map<string, string>();
  for (const item of items) for (const fact of item.facts.filter(f => f.label === "თავისებურება"))
    for (const stem of stems(fact.value)) if (stem.length >= 5) dictionary.set(stem, fact.value);
  const flags = new Map<string, string[]>();
  for (const item of items) {
    const own = item.facts.map(f => f.value.toLowerCase()).join(" ");
    const text = item.proposal?.toLowerCase() ?? "";
    const matches = [...dictionary].filter(([stem]) => text.includes(stem) && !own.includes(stem));
    if (matches.length) flags.set(item.productId, [...new Set(matches.map(([,feature]) => "შეამოწმე სხვა მოდელთან ნახსენები თავისებურება · " + feature))]);
  }
  return flags;
}
