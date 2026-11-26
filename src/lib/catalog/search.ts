import type { Catalog, Product } from "./types";
import { translit } from "../translit";

/** Public, JSON-serializable search data. Never send the full catalog to the header. */
export interface SearchDocument {
  id: string;
  slug: string;
  name: string;
  model: string | null;
  brandId: string | null;
  brandName: string | null;
  typeId: string;
  categoryId: string;
  price: number | null;
  image: string | null;
  availability: Product["availability"]["status"];
  codes: string[];
  /** Short existing public names only: no descriptions, review notes, or provenance. */
  aliases: string[];
}

export interface SearchTaxon {
  id: string;
  label: string;
  href: string;
  count: number;
  aliases?: string[];
}

export interface CatalogSearchIndex {
  products: SearchDocument[];
  types: SearchTaxon[];
  categories: SearchTaxon[];
  brands: { id: string; name: string; nameKa?: string }[];
}

export interface SearchMatch {
  item: SearchDocument;
  score: number;
  match: "exact" | "prefix" | "transliteration" | "fuzzy";
}

export interface CatalogSearchResult {
  query: string;
  products: SearchMatch[];
  total: number;
  /** A real word correction, never a silently changed model or number. */
  correction: string | null;
  types: SearchTaxon[];
  categories: SearchTaxon[];
}

const slug = (id: string) => id.toLowerCase().replace(/_/g, "-");
const TYPE_ALIASES: Record<string, string[]> = { MOTOBLOCK: ["კულტივატორი", "კულტივატორები"] };

export function createSearchIndex(catalog: Catalog, products: Product[] = catalog.products): CatalogSearchIndex {
  const visible = products.filter((product) => product.visible);
  const brands = new Map(catalog.brands.map((brand) => [brand.id, brand]));
  const count = (key: "product_type" | "category", id: string) => visible.filter((p) => p[key] === id).length;
  return {
    products: visible.map((p) => {
      const image = p.media.find((m) => m.role === "main") ?? p.media[0];
      return {
        id: p.id, slug: p.slug, name: p.name, model: p.model,
        brandId: p.brand, brandName: p.brand ? brands.get(p.brand)?.name ?? p.brand : null,
        typeId: p.product_type, categoryId: p.category,
        price: p.price.promo ?? p.price.base, image: image ? `/media/${image.file}` : null,
        availability: p.availability.status, codes: Object.values(p.codes).filter(Boolean),
        aliases: [...new Set([p.name_legacy, p.subtitle].filter((value): value is string => Boolean(value)))],
      };
    }),
    types: catalog.product_types.map((type) => ({
      id: type.id, label: type.name_plural, aliases: [type.name, type.id.toLowerCase().replace(/_/g, " "), ...(TYPE_ALIASES[type.id] ?? [])],
      href: `/catalog/${slug(type.category)}/${slug(type.id)}`, count: count("product_type", type.id),
    })).filter((type) => type.count > 0),
    categories: catalog.categories.map((category) => ({
      id: category.id, label: category.name, href: `/catalog/${slug(category.id)}`, count: count("category", category.id),
    })).filter((category) => category.count > 0),
    brands: catalog.brands.map((brand) => ({ id: brand.id, name: brand.name, ...(brand.name_ka ? { nameKa: brand.name_ka } : {}) })),
  };
}

const KEYBOARD: Record<string, string> = {
  q: "ქ", w: "წ", e: "ე", r: "რ", t: "ტ", y: "ყ", u: "უ", i: "ი", o: "ო", p: "პ",
  a: "ა", s: "ს", d: "დ", f: "ფ", g: "გ", h: "ჰ", j: "ჯ", k: "კ", l: "ლ",
  z: "ზ", x: "ხ", c: "ც", v: "ვ", b: "ბ", n: "ნ", m: "მ",
  T: "თ", R: "ღ", S: "შ", J: "ჟ", C: "ჩ", W: "ჭ", Z: "ძ",
};
const LATIN_KEYS = Object.fromEntries(Object.entries(KEYBOARD).map(([key, letter]) => [letter, key]));
const georgianKeys = (value: string) => [...value].map((char) => KEYBOARD[char] ?? KEYBOARD[char.toLowerCase()] ?? char).join("");
const latinKeys = (value: string) => [...value].map((char) => LATIN_KEYS[char] ?? char).join("");
const fold = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/ı/g, "i");
const identifier = (value: string) => {
  const normalized = fold(value).replace(/\s/g, "").replace(/[‐‑–—]/g, "-");
  // A separator between numbers can be a dimension: 4.00-8 must not become 4.0-08.
  return normalized.replace(/[-_]/g, (separator, offset: number) =>
    /\d/.test(normalized[offset - 1] ?? "") && /\d/.test(normalized[offset + 1] ?? "") ? separator : "");
};
const words = (value: string) => value.match(/[\p{L}\p{N}]+(?:[.\/-][\p{L}\p{N}]+)*/gu) ?? [];
const hasNumber = (value: string) => /\d/.test(value);

interface Term {
  raw: string;
  primary: string;
  forms: string[];
  numeric: boolean;
}

function term(raw: string): Term {
  const numeric = hasNumber(raw);
  // A Latin model letter is an identifier, not a word to transliterate (170F must not become 170P).
  const variants = numeric
    ? [raw, /[ა-ჰᲐ-Ჿ]/u.test(raw) ? latinKeys(raw.toLowerCase()) : raw]
    : [raw, translit(raw.toLowerCase()), latinKeys(raw.toLowerCase()), translit(georgianKeys(raw))];
  return { raw, primary: identifier(raw), forms: [...new Set(variants.map(identifier))], numeric };
}

interface WeightedTerm extends Term { weight: number; correctable: boolean; identifier?: boolean }
interface PreparedDocument { item: SearchDocument; terms: WeightedTerm[]; identifiers: string[] }
interface PreparedIndex { products: PreparedDocument[]; vocabulary: WeightedTerm[] }
const preparedIndexes = new WeakMap<CatalogSearchIndex, PreparedIndex>();

function prepare(index: CatalogSearchIndex): PreparedIndex {
  const cached = preparedIndexes.get(index);
  if (cached) return cached;
  const types = new Map(index.types.map((type) => [type.id, type]));
  const categories = new Map(index.categories.map((category) => [category.id, category]));
  const brands = new Map(index.brands.map((brand) => [brand.id, brand]));
  const protectedIdentifiers = new Set(index.products.flatMap((item) => [item.model, ...item.codes])
    .filter((value): value is string => Boolean(value) && !hasNumber(value!)).map(identifier));
  const vocabulary = new Map<string, WeightedTerm>();
  const products = index.products.map((item) => {
    const terms = new Map<string, WeightedTerm>();
    function add(value: string | undefined | null, weight: number, correctable = true, modelOrCode = false) {
      for (const raw of words(value ?? "")) {
        const next = { ...term(raw), weight, correctable: correctable && !hasNumber(raw) && !protectedIdentifiers.has(identifier(raw)), identifier: modelOrCode };
        const previous = terms.get(next.primary);
        if (!previous || previous.weight < weight) terms.set(next.primary, next);
        if (next.correctable && next.primary.length >= 4) {
          const previousWord = vocabulary.get(next.primary);
          if (!previousWord || previousWord.weight < weight) vocabulary.set(next.primary, next);
        }
        if (hasNumber(raw)) {
          // Exact numeric/letter segments allow "AG 170" and "170 F", without fuzzy identifier matching.
          for (const part of raw.match(/[\p{L}]+|\d+(?:\.\d+)?/gu) ?? []) {
            const segment = { ...term(part), weight: weight - 10, correctable: false };
            if (!terms.has(segment.primary)) terms.set(segment.primary, segment);
          }
          for (const part of raw.split(/[-/]/)) {
            const segment = { ...term(part), weight: weight - 5, correctable: false };
            if (!terms.has(segment.primary)) terms.set(segment.primary, segment);
          }
        }
      }
    }
    const type = types.get(item.typeId);
    const category = categories.get(item.categoryId);
    const brand = item.brandId ? brands.get(item.brandId) : undefined;
    add(item.model, 130, false, true);
    item.codes.forEach((code) => add(code, 140, false, true));
    add(item.name, 80);
    add(brand?.name, 100); add(brand?.nameKa, 100);
    add(type?.label, 110); type?.aliases?.forEach((alias) => add(alias, 110));
    add(category?.label, 40);
    item.aliases.forEach((alias) => add(alias, 25));
    return { item, terms: [...terms.values()], identifiers: [item.model, ...item.codes].filter((value): value is string => Boolean(value)).map(identifier) };
  });
  const prepared = { products, vocabulary: [...vocabulary.values()] };
  preparedIndexes.set(index, prepared);
  return prepared;
}

function matchTerm(query: Term, candidate: WeightedTerm): { score: number; match: SearchMatch["match"] } | null {
  if (query.primary === candidate.primary) return { score: candidate.weight + 30, match: "exact" };
  if (query.forms.some((form) => candidate.forms.includes(form))) return { score: candidate.weight + 20, match: "transliteration" };
  if (query.numeric && candidate.numeric && candidate.identifier && query.primary.length >= 4) {
    const completesModel = query.forms.some((prefix) => /[a-z]/.test(prefix) && candidate.forms.some((full) => {
      if (!full.startsWith(prefix)) return false;
      const next = full[prefix.length] ?? "";
      // Complete literal model suffixes, but never extend an entered numeric group: MQ170 ≠ MQ1700.
      return !/\d$/.test(prefix) || !/[\d.]/.test(next);
    }));
    if (completesModel) return { score: candidate.weight - 10, match: "prefix" };
  }
  // Numeric tokens are never fuzzy or arbitrary substring matches.
  if (query.numeric || candidate.numeric || query.primary.length < 2) return null;
  if (candidate.forms.some((form) => query.forms.some((q) => form.startsWith(q)))) {
    return { score: candidate.weight, match: "prefix" };
  }
  return null;
}

function rank(products: PreparedDocument[], query: Term[]): SearchMatch[] {
  const matches: SearchMatch[] = [];
  for (const product of products) {
    let score = 0;
    let match: SearchMatch["match"] = "exact";
    let included = true;
    for (const token of query) {
      let best: ReturnType<typeof matchTerm> = null;
      for (const candidate of product.terms) {
        const found = matchTerm(token, candidate);
        if (found && (!best || found.score > best.score)) best = found;
      }
      if (!best) { included = false; break; }
      score += best.score;
      if (best.match === "prefix" || (best.match === "transliteration" && match === "exact")) match = best.match;
    }
    if (!included) continue;
    const phrase = identifier(query.map((token) => token.raw).join(" "));
    if (product.identifiers.includes(phrase)) score += 500;
    else if (identifier(product.item.name) === phrase) score += 300;
    matches.push({ item: product.item, score, match });
  }
  return matches.sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name, "ka") || a.item.id.localeCompare(b.item.id));
}

/** Small bounded Damerau-Levenshtein distance, including one adjacent key transposition. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  let beforePrevious = previous;
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let minimum = i;
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + Number(a[i - 1] !== b[j - 1]));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        row[j] = Math.min(row[j], beforePrevious[j - 2] + 1);
      }
      minimum = Math.min(minimum, row[j]);
    }
    if (minimum > max) return max + 1;
    beforePrevious = previous; previous = row;
  }
  return previous[b.length];
}

function corrections(token: Term, prepared: PreparedIndex): { term: Term; distance: number }[] {
  if (token.numeric || token.primary.length < 4) return [];
  // Do not change a valid word merely because the user's combination has no results.
  if (prepared.products.some((product) => product.terms.some((candidate) => matchTerm(token, candidate)))) return [];
  const max = token.primary.length >= 8 ? 2 : 1;
  const candidates = prepared.vocabulary.flatMap((candidate) => {
    let best = max + 1;
    for (const a of token.forms) for (const b of candidate.forms) {
      // Compare like scripts. A transliteration is already represented as a Latin form.
      if (/[ა-ჰ]/u.test(a) !== /[ა-ჰ]/u.test(b)) continue;
      best = Math.min(best, distance(a, b, max));
    }
    return best > 0 && best <= max ? [{ term: candidate, distance: best }] : [];
  });
  const sameScript = (candidate: Term) => Number(/[ა-ჰ]/u.test(fold(candidate.raw)) === /[ა-ჰ]/u.test(fold(token.raw)));
  candidates.sort((a, b) => a.distance - b.distance || sameScript(b.term) - sameScript(a.term)
    || b.term.weight - a.term.weight || a.term.raw.localeCompare(b.term.raw, "ka"));
  return candidates.slice(0, 3);
}

function taxonResults(taxa: SearchTaxon[], matches: SearchMatch[], key: "typeId" | "categoryId", query: Term[]) {
  const counts = new Map<string, number>();
  matches.forEach(({ item }) => counts.set(item[key], (counts.get(item[key]) ?? 0) + 1));
  return taxa.filter((taxon) => counts.has(taxon.id)).map((taxon) => {
    const tokens = words([taxon.label, ...(taxon.aliases ?? [])].join(" ")).map((raw) => ({ ...term(raw), weight: 1, correctable: false }));
    const direct = query.every((token) => tokens.some((candidate) => matchTerm(token, candidate)));
    return { taxon, score: (direct ? 1000 : 0) + (counts.get(taxon.id) ?? 0) };
  }).sort((a, b) => b.score - a.score).slice(0, 4).map(({ taxon }) => taxon);
}

/** Same deterministic matching for server result pages and client suggestions. */
export function searchCatalog(index: CatalogSearchIndex, input: string, options: { limit?: number; exact?: boolean } = {}): CatalogSearchResult {
  const query = input.trim();
  const result: CatalogSearchResult = { query, products: [], total: 0, correction: null, types: [], categories: [] };
  const tokens = words(query).map(term);
  if (!tokens.length || query.length > 200 || tokens.length > 12) return result;
  const prepared = prepare(index);
  let matches = rank(prepared.products, tokens);
  let effective = tokens;
  if (!matches.length && !options.exact) {
    const choices = tokens.map((token) => corrections(token, prepared));
    const changed = choices.filter((choice) => choice.length).length;
    if (changed > 0 && changed <= 2) {
      let combinations: { terms: Term[]; distance: number }[] = [{ terms: [], distance: 0 }];
      tokens.forEach((token, i) => {
        const alternatives = choices[i].length ? choices[i] : [{ term: token, distance: 0 }];
        combinations = combinations.flatMap((combination) => alternatives.map((alternative) => ({
          terms: [...combination.terms, alternative.term], distance: combination.distance + alternative.distance,
        })));
      });
      let best = -Infinity;
      for (const combination of combinations) {
        const found = rank(prepared.products, combination.terms);
        const score = (found[0]?.score ?? -Infinity) - combination.distance * 100;
        if (found.length && score > best) {
          best = score; matches = found.map((match) => ({ ...match, match: "fuzzy" })); effective = combination.terms;
          result.correction = effective.map((token) => token.raw).join(" ");
        }
      }
    }
  }
  result.total = matches.length;
  result.types = taxonResults(index.types, matches, "typeId", effective);
  result.categories = taxonResults(index.categories, matches, "categoryId", effective);
  result.products = options.limit === undefined ? matches : matches.slice(0, Math.max(0, options.limit));
  return result;
}
