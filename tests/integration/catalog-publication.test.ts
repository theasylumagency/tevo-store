import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { editorProduct, setGlobalRule, changeProduct, importCatalog, adminPricing, publishedPriceHistory } from "../../src/lib/catalog/editorial";
import { pricingImpact } from "../../src/lib/catalog/pricing";
import { parseRule } from "../../src/lib/catalog/publication";
import { readPublication } from "../../src/lib/catalog/published";
import type { Catalog } from "../../src/lib/catalog/types";

test("file input, drafts, publication, inherited pricing and recovery use independent store versions", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "store-catalog-"));
  const file = path.join(dir, "catalog.json");
  const input: Catalog = JSON.parse(await readFile("data/catalog.json", "utf8"));
  const p = input.products[0];
  p.price = { currency: "GEL", base: 100, promo: 90 };
  Object.assign(process.env, { DATABASE_URL: "pglite:memory", STORE_ID: "rodo", CATALOG_SOURCE: "file", CATALOG_PATH: file });
  const get = async () => (await editorProduct(p.id))!;
  const publicItem = async () => (await readPublication()).products.find(item => item.id === p.id)!;
  try {
    await writeFile(file, JSON.stringify(input));
    assert.deepEqual((await publicItem()).price, p.price);
    assert.equal(await importCatalog(), false);
    assert.throws(() => parseRule("fixed", "-0.01"));
    const { row } = await adminPricing();
    const rule = parseRule("percent", "12,50");
    const impact = pricingImpact(row, rule);
    assert.deepEqual(impact.find(v => v.id === p.id)?.after, { currency: "GEL", base: 112.5, promo: 101.25 });
    assert.ok(impact.find(v => v.id === p.id)?.promotion);
    assert.equal(impact.find(v => v.source.base === null)?.changed, false);
    assert.deepEqual((await publicItem()).price, p.price);
    await setGlobalRule(rule, row.published.generated_at, "admin");
    assert.deepEqual((await publishedPriceHistory(p.id))[0].before, p.price);
    assert.deepEqual((await publicItem()).price, { currency: "GEL", base: 112.5, promo: 101.25 });

    const previewVersion = (await readPublication()).generated_at;
    const original = await get();
    const edits = { name: "მაღაზიის სათაური", description: "აღწერა", rule: parseRule("fixed", "3.01")! };
    await changeProduct(p.id, original.token, { type: "save", edits }, "editor");
    assert.deepEqual((await get()).edit?.draft, edits);
    assert.equal((await publicItem()).name, p.name);
    await assert.rejects(changeProduct(p.id, original.token, { type: "save", edits: {} }, "editor"));

    const ready = await get();
    const attempts = await Promise.allSettled([1, 2].map(() => changeProduct(p.id, ready.token, { type: "publish" }, "admin")));
    assert.equal(attempts.filter(a => a.status === "fulfilled").length, 1);
    const published = await get();
    assert.equal(published.history.length, 2);
    assert.equal(published.applied.origin, "product");
    assert.equal((await publicItem()).price.promo, 93.01);
    assert.equal((await publicItem()).name, edits.name);

    await assert.rejects(setGlobalRule(null, previewVersion, "admin"), /ვერსია შეიცვალა/);
    const exception = pricingImpact((await adminPricing()).row, null).find(v => v.id === p.id)!;
    assert.equal(exception.exception, true);
    assert.equal(exception.changed, false);
    assert.deepEqual((await publishedPriceHistory(p.id)).map(h => h.reason), ["product", "global"]);

    // A changed file may keep the source timestamp and count. A draft never leaks on reimport.
    await changeProduct(p.id, published.token, { type: "save", edits: { name: "მონახაზი" } }, "editor");
    p.name = "წყაროს ახალი სათაური";
    p.price.base = 99;
    await writeFile(file, JSON.stringify(input));
    assert.equal((await publicItem()).price.base, 103.01);
    assert.equal(await importCatalog(), true);
    assert.equal((await publicItem()).price.base, 102.01);
    assert.equal((await get()).edit?.draft?.name, "მონახაზი");
    assert.equal((await publicItem()).name, edits.name);
    await assert.rejects(changeProduct(p.id, published.token, { type: "publish" }, "admin"));

    const afterImport = await get();
    const baseline = afterImport.history.at(-1)!;
    await changeProduct(p.id, afterImport.token, { type: "restore", id: baseline.id }, "editor");
    assert.equal((await publicItem()).name, edits.name);
    await changeProduct(p.id, (await get()).token, { type: "publish" }, "admin");
    assert.equal((await publicItem()).name, p.name);
    assert.equal((await publicItem()).price.base, 111.38);
    assert.equal((await get()).applied.origin, "store");

    const transitions = await publishedPriceHistory(p.id);
    assert.deepEqual(transitions.map(h => h.reason), ["product", "import", "product", "global"]);
    assert.deepEqual(transitions[0].after, (await publicItem()).price);
    const beforeFailure = await readPublication();
    await writeFile(file, JSON.stringify({ ...input, products: [...input.products, p] }));
    await assert.rejects(importCatalog());
    await rm(file);
    await assert.rejects(importCatalog());
    assert.deepEqual(await readPublication(), beforeFailure);
    const unknownPrice = beforeFailure.products.find(product => product.price.base === null);
    assert.ok(unknownPrice);
    assert.equal(unknownPrice.price.promo, null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
