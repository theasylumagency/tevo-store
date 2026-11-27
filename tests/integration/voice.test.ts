import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { eq } from "drizzle-orm";
import { getDb } from "../../src/db";
import { notifications, voiceItems, voiceRuns } from "../../src/db/schema";
import { changeProduct, editorProduct, importCatalog } from "../../src/lib/catalog/editorial";
import { readPublication } from "../../src/lib/catalog/published";
import type { Catalog } from "../../src/lib/catalog/types";
import { presets } from "../../src/lib/voice/model";
import { generateGroup } from "../../src/lib/voice/provider";
import { processVoiceQueue } from "../../src/lib/voice/worker";
import { approveVoice, createRun, publishApproved, readRun, reviewItem, voiceDashboard } from "../../src/lib/voice/service";

test("audition, approval, grouped catalog, retries, drafts, and publication are independent and versioned", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "store-voice-"));
  const file = path.join(dir, "catalog.json");
  Object.assign(process.env, { DATABASE_URL: "pglite:memory", STORE_ID: "rodo", CATALOG_SOURCE: "file", CATALOG_PATH: file,
    RODO_AI_MODEL: "test-model", RODO_OPENAI_API_KEY: "offline-test", STAFF_EMAILS: "store@example.test" });
  try {
    const source: Catalog = JSON.parse(await readFile("data/catalog.json", "utf8"));
    source.products = source.products.filter(p => p.visible && !p.data_quality.issues.includes("CONFLICT")).slice(0, 14);
    await writeFile(file, JSON.stringify(source));
    const available = (await voiceDashboard()).products;
    const [p, q, stale, manual] = available;
    async function edit(id: string, edits: Parameters<typeof changeProduct>[2]) {
      await changeProduct(id, (await editorProduct(id))!.token, edits, "admin");
    }
    await edit(p.id, { type: "save", edits: { name: "ადგილობრივი სათაური", rule: { kind: "fixed", amount: 125 } } });
    await edit(p.id, { type: "publish" });
    await edit(manual.id, { type: "save", edits: { description: "ადმინისტრატორის აღწერა" } });
    await edit(manual.id, { type: "publish" });
    const ids = [p.id, q.id, stale.id];
    const trial = randomUUID();
    const profile = presets[2].profile;
    delete process.env.RODO_OPENAI_API_KEY;
    await assert.rejects(createRun(trial, "audition", ids, 0, null));
    process.env.RODO_OPENAI_API_KEY = "offline-test";
    await assert.rejects(createRun(randomUUID(), "catalog", ids, 0, null));
    await assert.rejects(createRun(trial, "audition", [p.id,q.id,manual.id], 0, null));
    await Promise.all([1,2].map(() => createRun(trial, "audition", ids, 0, null, profile, true)));
    await assert.rejects(approveVoice(trial, true));
    const liveBefore = await readPublication();
    const calls: string[][] = [];
    const generator: typeof generateGroup = async (voice, products, model, examples) => generateGroup(voice, products, model, examples, async (_, req) => {
      const body = JSON.parse(req!.body as string);
      assert.equal(body.store, false);
      assert.equal(body.text.format.strict, true);
      assert.equal(body.model, "test-model");
      const input = JSON.parse(body.input);
      assert.equal(input.products.length, products.length);
      assert.deepEqual(input.approvedStyleExamples, examples);
      calls.push(products.map(p => p.sku));
      const output = [...products].reverse().map(p => ({ sku: p.sku, paragraphs: [{ text: p.facts[0].value + " · აღწერა.", sources: [p.sku + ":1"] }] }));
      return Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ products: output }) }] }] });
    });
    await Promise.all([processVoiceQueue(generator), processVoiceQueue(generator)]);
    assert.deepEqual(calls, [ids]);
    assert.equal((await (await getDb()).select().from(notifications).where(eq(notifications.event, "voice_ready"))).length, 1);
    const samples = (await readRun(trial))!.items;
    await assert.rejects(reviewItem(trial, samples[0].id, samples[0].revision, "approve", samples[0].proposal!, true, "admin"));
    await assert.rejects(publishApproved(trial, new Map()));
    await approveVoice(trial, true);
    await approveVoice(trial, true);
    const db = await getDb();
    const dashboard = await voiceDashboard();
    assert.equal(dashboard.active?.id, trial);
    assert.equal(dashboard.plan!.reused, 3);
    assert.ok(!dashboard.plan!.ids.includes(manual.id));
    assert.deepEqual(dashboard.suggested, ids);
    const catalog = randomUUID();
    await assert.rejects(createRun(catalog, "catalog", dashboard.plan!.ids, 1, trial, undefined, false, "stale-preview"));
    await createRun(catalog, "catalog", dashboard.plan!.ids, 1, trial, undefined, false, dashboard.plan!.token);
    const incoming = async () => (await readRun(catalog))!.items;
    const reused = (await incoming()).filter(i => i.status === "review");
    assert.equal(reused.length, 3);
    for (const i of reused) assert.deepEqual(i.paragraphs, samples.find(s => s.productId === i.productId)!.paragraphs);
    const firstFailure = await processVoiceQueue(async () => { throw Error("private diagnostic"); });
    assert.ok(firstFailure.processed > 0);
    const failed = (await incoming()).filter(i => i.status === "failed");
    assert.equal(failed.length, firstFailure.processed);
    assert.ok(failed.every(i => !i.error?.includes("private diagnostic")));
    await reviewItem(catalog, failed[0].id, failed[0].revision, "retry", "", false, "admin");
    assert.equal((await incoming()).filter(i => i.status === "failed").length, 0);
    while ((await processVoiceQueue(generator)).processed) { /* drain the local fixture */ }
    assert.equal(calls.length, dashboard.plan!.requests + 1);
    assert.ok(calls.slice(1).every(group => group.length <= 8 && group.every(id => !ids.includes(id)) &&
      new Set(group.map(id => source.products.find(p => p.id === id)!.product_type)).size === 1));
    const ready = (await readRun(catalog))!;
    assert.ok(ready.run.completedAt);
    assert.equal(ready.run.examples?.length, 3);
    assert.equal(ready.previous.get(p.id)?.runId, trial);
    assert.deepEqual(await readPublication(), liveBefore);
    const bySku = new Map(ready.items.map(i => [i.productId, i]));
    const first = bySku.get(p.id)!, second = bySku.get(q.id)!, third = bySku.get(stale.id)!;
    await assert.rejects(reviewItem(catalog, first.id, first.revision, "approve", first.proposal!, true, "editor"));
    await assert.rejects(reviewItem(catalog, first.id, first.revision, "approve", "სიმძლავრე 999999 კვტ", true, "admin"));
    await reviewItem(catalog, first.id, first.revision, "approve", first.proposal!, true, "admin");
    const humanCopy = "ხელით დაზუსტებული აღწერა.";
    await reviewItem(catalog, second.id, second.revision, "save", humanCopy, true, "editor");
    await assert.rejects(reviewItem(catalog, second.id, second.revision, "approve", humanCopy, true, "admin"));
    await reviewItem(catalog, second.id, second.revision + 1, "approve", humanCopy, true, "admin");
    await reviewItem(catalog, third.id, third.revision, "approve", third.proposal!, true, "admin");
    await edit(third.productId, { type: "save", edits: { description: "ახალი მონახაზი" } });
    const selected = (await incoming()).filter(i => ids.includes(i.productId));
    assert.deepEqual(await publishApproved(catalog, new Map(selected.map(i => [i.id, i.revision])), true), { count: 2, stale: 1 });
    const live = (await readPublication()).products;
    assert.deepEqual(live.find(i => i.id === p.id), { ...liveBefore.products.find(i => i.id === p.id), description: first.proposal });
    assert.equal(live.find(i => i.id === q.id)!.description, humanCopy);
    assert.equal((await editorProduct(stale.id))?.edit?.draft?.description, "ახალი მონახაზი");
    assert.ok((await editorProduct(p.id))!.history[0].resolved?.description === first.proposal);
    source.products.find(v => v.id === p.id)!.features = ["განახლებული სახელური"];
    await writeFile(file, JSON.stringify(source));
    await importCatalog();
    const next = (await voiceDashboard()).plan!;
    assert.deepEqual(next.ids, [p.id]);
    assert.equal(next.reused, 0);
    const changedRun = randomUUID();
    await createRun(changedRun, "catalog", next.ids, 1, trial, undefined, false, next.token);
    const [changed] = (await readRun(changedRun))!.items;
    await db.update(voiceItems).set({ status: "working", lease: new Date(0) }).where(eq(voiceItems.id, changed.id));
    assert.equal((await processVoiceQueue(generator)).processed, 0);
    assert.equal((await readRun(changedRun))!.items[0].status, "failed");

    // Previously deployed runs with nullable new columns are still browsable and queued work is recoverable.
    const legacy = randomUUID();
    await db.insert(voiceRuns).values({ id: legacy, storeId: "rodo", scope: "selected", profileVersion: 0,
      profile, model: "test-model", sourceVersion: "legacy" });
    await db.insert(voiceItems).values({ runId: legacy, productId: p.id, name: p.name, digest: first.digest, original: "",
      editRevision: 0, facts: first.facts, flags: [], status: "queued" });
    await processVoiceQueue(generator);
    assert.equal((await readRun(legacy))!.items[0].status, "review");
    assert.equal((await readRun(legacy))!.canPublish, false);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("group responses cannot borrow citations, omit SKUs, duplicate them, or substitute an unknown SKU", async () => {
  process.env.RODO_OPENAI_API_KEY = "offline-test";
  const products = ["a","b"].map(sku => ({ sku, facts: [{ label: "ფაქტი", value: sku }] }));
  async function attempt(entries: string[][]) {
    return generateGroup(presets[0].profile, products, "fixture", [], async () => Response.json({ status: "completed",
      output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({
        products: entries.map(([sku, source]) => ({ sku, paragraphs: [{ text: "აღწერა", sources: [source] }] })),
      }) }] }] }));
  }
  for (const invalid of [
    [["a","a:1"]], [["a","a:1"],["a","a:1"]], [["a","b:1"],["b","b:1"]], [["x","a:1"],["b","b:1"]],
  ]) await assert.rejects(attempt(invalid), /ჯგუფის პასუხი/);
  assert.deepEqual([...(await attempt([["b","b:1"],["a","a:1"]])).keys()], ["a","b"]);
});
