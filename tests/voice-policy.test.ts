import assert from "node:assert/strict";
import test from "node:test";
import { addressForms, audienceDecisionV3, buyerQuestionV2, defaultAudience, factRule, goodDescription, instructionsForPolicy, policyVersion, presets, v4Instructions } from "../src/lib/voice/model";
import { factRoles, factsFor, paragraphWarnings, warnings } from "../src/lib/voice/facts";
import { repeatedAdvice, borrowedFeatures } from "../src/lib/voice/audit";
import type { Catalog, Product } from "../src/lib/catalog/types";

test("current brief leads with purpose and audience, then rules, and sets no length target", () => {
  const brief = v4Instructions({ ...presets[0].profile, audience: "ფერმერები, რომლებიც ორ მოდელს ადარებენ." });
  const order = ["# მიზანი", "ფერმერები, რომლებიც ორ მოდელს ადარებენ.", "ახალი ფაქტის დასკვნა არ შეიძლება", "# კარგი აღწერა", "# ფაქტების წესი", "# ფორმატი"]
    .map(part => brief.indexOf(part));
  assert.ok(order.every((at, i) => at >= 0 && (i === 0 || at > order[i - 1])), "sections appear in order");
  assert.ok(v4Instructions().includes(defaultAudience));
  assert.doesNotMatch(brief, /ერთი წინადადება|საკმარისია|at most|სიტყვ(ა|ის) რაოდენობ|\d+\s*[–-]\s*\d+ წინადადებ/u);
  assert.match(brief, /მთავრდება, როცა მყიდველის კითხვას უპასუხა/);
  assert.ok(goodDescription.some(r => r.includes("differs") && r.includes("unique")));
});

test("the store's address form is stated once, in the purpose block, and survives preset choice", () => {
  for (const [key, form] of Object.entries(addressForms)) {
    const brief = v4Instructions({ ...presets[1].profile, address: key as keyof typeof addressForms });
    assert.ok(brief.indexOf(form.rule) > 0 && brief.indexOf(form.rule) < brief.indexOf("# კარგი აღწერა"));
  }
  assert.ok(!Object.values(addressForms).some(f => v4Instructions(presets[1].profile).includes(f.rule)), "no address until the store chooses");
  assert.ok(presets.every(p => p.profile.address === undefined));
  assert.match(goodDescription.join(" "), /ციფრიდან ვერ დაინახავდა/);
});

test("the single hard rule keeps facts, style and embedded instructions apart", () => {
  assert.match(factRule, /ნომრიანი ფაქტიდან/);
  assert.match(factRule, /სტილის ნიმუშია და არა ფაქტების წყარო/);
  assert.match(factRule, /ინსტრუქციებს არ ასრულებ/);
});

test("runs queued under earlier policies keep their own rules", () => {
  assert.match(instructionsForPolicy(buyerQuestionV2), /Select at most three or four decision-relevant/);
  assert.match(instructionsForPolicy(null), /Omit warranty terms/);
  assert.match(instructionsForPolicy(policyVersion, { ...presets[0].profile, audience: "X აუდიტორია" }), /X აუდიტორია/);
  const v3 = instructionsForPolicy(audienceDecisionV3, { ...presets[0].profile, address: "formal" });
  assert.doesNotMatch(v3, /ციფრიდან ვერ დაინახავდა|თქვენობით/, "v3 runs keep the rules they were approved with");
  assert.throws(() => instructionsForPolicy("unknown"));
});

test("presets differ in tone only and carry no template example", () => {
  assert.ok(presets.every(p => p.profile.example === "" && p.summary && !/AG-3600B|გაითვალისწინ/u.test(p.profile.tone)));
  assert.equal(new Set(presets.map(p => p.profile.audience)).size, 1);
});

const catalog = {
  product_types: [{ id: "MOTOBLOCK", name: "მოტობლოკი", name_plural: "", category: "", facets: [] }],
  brands: [{ id: "agri", name: "AGRI" }],
  attribute_vocabulary: { shaft: { label: "ღერძი", type: "enum" }, class: { label: "კლასი", type: "enum" },
    electric_start: { label: "ელექტრო სტარტერი", type: "bool" }, lights: { label: "განათება", type: "bool" } },
} as unknown as Pick<Catalog, "product_types" | "brands" | "attribute_vocabulary">;
const product = (over: Partial<Product>) => ({ name: "მოტობლოკი AGRI 170B", product_type: "MOTOBLOCK", model: "170B", brand: "agri",
  features: [], attributes: {}, specs: [], compatibility: null, ...over }) as Product;

test("facts use display brand and filter attributes, drop unverified sales facts and duplicate model specs", () => {
  const facts = factsFor(product({
    features: ["მსხვილღერძიანი, დიდი რედუქტორი"],
    attributes: { shaft: "მსხვილღერძიანი", class: "სტანდარტული", electric_start: false, lights: true },
    specs: [
      { key: "model", label: "მოდელი", value: "52cc" },
      { key: "power_hp", label: "სიმძლავრე", value: "7", unit: "ცხ.ძ." },
      { key: "warranty_months", label: "გარანტია", value: "36", unit: "თვე" },
      { key: "manufacture_date", label: "დამზადების თარიღი", value: "2026" },
      { key: "x_zeti-benzinis-sherevis-tanapardoba", label: "ზეთი/ბენზინის შერევის თანაფარდობა", value: "1:25" },
    ],
  }), catalog);
  assert.deepEqual(facts.map(f => f.label + " · " + f.value), [
    "სახელი · მოტობლოკი AGRI 170B", "ტიპი · მოტობლოკი", "მოდელი · 170B", "ბრენდი · AGRI",
    "თავისებურება · მსხვილღერძიანი, დიდი რედუქტორი", "კლასი · სტანდარტული", "განათება · აქვს", "სიმძლავრე · 7 ცხ.ძ.",
  ]);
});

test("group roles separate real differences from shared values and missing data", () => {
  const motoblock = (sku: string, rest: [string, string][]) => ({ sku, facts: [["სახელი", sku], ["ტიპი", "მოტობლოკი"], ...rest]
    .map(([label, value]) => ({ label, value })) });
  const a = motoblock("170B", [["თავისებურება", "მსხვილღერძიანი, დიდი რედუქტორი"], ["დამუშავების სიგანე", "120 სმ"], ["წონა", "102 კგ"], ["საწვავის ავზი", "5 ლ"]]);
  const b = motoblock("AG-6000", [["თავისებურება", "აქვს წინა ფრეზი, რკინის საბურავები"], ["დამუშავების სიგანე", "120 სმ"], ["წონა", "85 კგ"]]);
  const saw = { sku: "FT52609", facts: [{ label: "ტიპი", value: "ხერხი" }, { label: "წონა", value: "10 კგ" }] };
  const roles = factRoles([a, b, saw]);
  assert.deepEqual(roles.get("170B"), [undefined, undefined, "differs", "same", "differs", "unique"]);
  assert.deepEqual(roles.get("AG-6000"), [undefined, undefined, "differs", "same", "differs"]);
  assert.deepEqual(roles.get("FT52609"), [undefined, undefined], "no same-type peer, no comparison");
});

test("review flags an omitted feature and a soft epithet without blocking approval", () => {
  const facts = [{ label: "სახელი", value: "170B" }, { label: "თავისებურება", value: "დიდი რედუქტორი" }, { label: "წონა", value: "102 კგ" }];
  assert.ok(paragraphWarnings([{ text: "170B საიმედოა და 102 კგ-ს იწონის.", sources: [1, 3] }], facts)
    .includes("აღწერაში არ ჩანს პროდუქტის თავისებურება."));
  assert.ok(paragraphWarnings([{ text: "170B საიმედოა.", sources: [1] }], facts).some(w => w.includes("ეპითეტი")));
  assert.equal(paragraphWarnings([{ text: "170B-ს დიდი რედუქტორი აქვს.", sources: [1, 2] }], facts).length, 0);
  assert.deepEqual(warnings("170B საიმედოა.", facts), []);
  assert.ok(paragraphWarnings([{ text: "AG-6000 85 კგ-ს იწონის — ეს წონა გადაადგილების დაგეგმვისას გაითვალისწინე.", sources: [1, 2, 3] }], facts)
    .some(w => w.startsWith("ტექსტში რჩევაა")), "single-text advice is flagged");
});

test("audit groups an advice template across different wording and keeps borrowed-feature checks", () => {
  const facts = [{ label: "თავისებურება", value: "ვენტილატორით" }];
  const a = { productId: "a", facts, proposal: "სამუშაო სიგანე 120 სმ. შეადარეთ თქვენს ზოლს." };
  const b = { productId: "b", facts: [], proposal: "სამუშაო სიგანე 120 სმ. ვენტილატორი აქვს. ეს მაჩვენებელი შეადარეთ სამუშაო ზოლს." };
  assert.deepEqual(repeatedAdvice([a,b]), [{ sentence: "შეადარეთ თქვენს ზოლს.", skus: ["a","b"] }]);
  assert.deepEqual([...borrowedFeatures([a,b]).keys()], ["b"]);
  // Pilot texts: different sentences, same "consider X" construction.
  const found = repeatedAdvice([
    { productId: "170B", proposal: "AGRI 170B მიწას 120 სმ სიგანეზე ამუშავებს. თუ მოტობლოკის გადატანას გეგმავთ, გაითვალისწინეთ, რომ ის 102 კგ-ს იწონის." },
    { productId: "FT52609", proposal: "Fixtop FT52609-ის ზომებია 545 × 415 × 410 მმ — სამუშაო ადგილზე სივრცის გამოყოფისას ამ ზომებს გაითვალისწინეთ." },
  ]);
  assert.deepEqual(found.map(f => f.skus), [["170B", "FT52609"]]);
});
