import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { eq } from "drizzle-orm";
import { getDb } from "../../src/db";
import { voiceItems } from "../../src/db/schema";
import { changeProduct, editorProduct, importCatalog } from "../../src/lib/catalog/editorial";
import { readPublication } from "../../src/lib/catalog/published";
import type { Catalog } from "../../src/lib/catalog/types";
import { chooseProducts, defaultProfile } from "../../src/lib/voice/model";
import { generateDescription } from "../../src/lib/voice/provider";
import { processVoiceQueue } from "../../src/lib/voice/worker";
import { createRun, publishApproved, readRun, reviewItem, saveProfile, voiceDashboard } from "../../src/lib/voice/service";

test("voice suggestions use versioned facts, private paid jobs and explicit approval; concurrent edits survive publication", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "store-voice-"));
  const file = path.join(dir, "catalog.json");
  Object.assign(process.env, { DATABASE_URL: "pglite:memory", STORE_ID: "rodo", CATALOG_SOURCE: "file", CATALOG_PATH: file,
    RODO_AI_MODEL: "test-model", RODO_OPENAI_API_KEY: "offline-test" });
  try {
    const source: Catalog = JSON.parse(await readFile("data/catalog.json", "utf8"));
    await writeFile(file, JSON.stringify(source));
    const available = (await voiceDashboard()).products.filter(p => !p.blocked);
    const [p, q, stale, manual] = available;
    const changes = { name: "ადგილობრივი სათაური", rule: { kind: "fixed" as const, amount: 125 } };
    async function edit(id: string, edits: Parameters<typeof changeProduct>[2]) {
      const data = (await editorProduct(id))!;
      await changeProduct(id, data.token, edits, "admin");
    }
    await edit(p.id, { type: "save", edits: changes });
    await edit(p.id, { type: "publish" });
    await edit(manual.id, { type: "save", edits: { description: "ადმინისტრატორის აღწერა" } });
    await edit(manual.id, { type: "publish" });
    await saveProfile(0, { ...defaultProfile, tone: "მოკლე, მშვიდი ქართული." });
    await assert.rejects(saveProfile(0, defaultProfile));
    const run = randomUUID();
    delete process.env.RODO_OPENAI_API_KEY;
    await assert.rejects(createRun(run, "selected", [p.id], 1));
    process.env.RODO_OPENAI_API_KEY = "offline-test";
    const ids = [p.id, q.id, stale.id];
    await assert.rejects(createRun(randomUUID(), "selected", [...ids, manual.id], 1));
    await Promise.all([createRun(run, "selected", ids, 1), createRun(run, "selected", ids, 1)]);
    await assert.rejects(createRun(randomUUID(), "selected", [p.id], 1));
    const incoming = async () => (await readRun(run))!.items;
    assert.equal((await incoming()).length, 3);
    const liveBefore = await readPublication();
    let calls = 0;
    const injection: typeof generateDescription = async (profile, facts, model) => generateDescription(profile, facts, model, async (url, req) => {
      assert.equal(String(url), "https://api.openai.com/v1/responses");
      const body = JSON.parse(req!.body as string);
      assert.equal(body.store, false);
      assert.equal(body.text.format.strict, true);
      assert.equal(JSON.parse(body.input).profile.tone, "მოკლე, მშვიდი ქართული.");
      assert.equal(body.model, "test-model");
      assert.match(body.input, /მოდელი|სახელი/);
      calls++;
      return Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text",
        text: JSON.stringify({ paragraphs: [{ text: facts[0].value + " — კატალოგის პროდუქტი.", sources: [1] }] }) }] }] });
    });
    await Promise.all([processVoiceQueue(injection), processVoiceQueue(injection)]);
    assert.equal(calls, 3);
    const [first, second, third] = await incoming();
    assert.equal(first.status, "review");
    assert.deepEqual(await readPublication(), liveBefore);
    await assert.rejects(reviewItem(run, first.id, first.revision, "approve", first.proposal!, true, "editor"));
    await assert.rejects(reviewItem(run, first.id, first.revision, "approve", "სიმძლავრე 999999 კვტ", true, "admin"));
    await reviewItem(run, first.id, first.revision, "approve", first.proposal!, true, "admin");
    const humanCopy = "ხელით დაზუსტებული აღწერა.";
    await reviewItem(run, second.id, second.revision, "save", humanCopy, true, "editor");
    await assert.rejects(reviewItem(run, second.id, second.revision, "approve", second.proposal!, true, "admin"));
    await reviewItem(run, second.id, second.revision + 1, "approve", humanCopy, true, "admin");
    await reviewItem(run, third.id, third.revision, "approve", third.proposal!, true, "admin");
    await edit(third.productId, { type: "save", edits: { description: "ახალი მონახაზი" } });
    assert.deepEqual(await readPublication(), liveBefore);
    const ready = await incoming();
    assert.deepEqual(await publishApproved(run, new Map(ready.map(i => [i.id, i.revision]))), { count: 2, stale: 1 });
    const live = (await readPublication()).products;
    const item = (id: string) => live.find(v => v.id === id)!;
    assert.deepEqual(item(p.id), { ...liveBefore.products.find(v => v.id === p.id), description: first.proposal });
    assert.equal(item(q.id).description, humanCopy);
    assert.equal((await editorProduct(stale.id))?.edit?.draft?.description, "ახალი მონახაზი");
    assert.ok((await editorProduct(p.id))!.history[0].resolved?.description === first.proposal);

    const changed = source.products.find(v => v.id === p.id)!;
    changed.features = ["განახლებული სახელური"];
    await writeFile(file, JSON.stringify(source));
    await importCatalog();
    const next = randomUUID();
    await createRun(next, "changed", [p.id], 1);
    const nextItems = (await readRun(next))!.items;
    assert.deepEqual(nextItems.map(i => i.productId), [p.id]);
    await processVoiceQueue(async () => { throw Error("private-provider-diagnostics"); });
    const failure = (await readRun(next))!.items[0];
    assert.equal(failure.status, "failed");
    assert.ok(!failure.error!.includes("private-provider"));
    await reviewItem(next, failure.id, failure.revision, "retry", "", false, "admin");
    // Simulate a process exit after claim; an expired lease must not silently repeat a paid request.
    await (await getDb()).update(voiceItems).set({ status: "working", lease: new Date(0) }).where(eq(voiceItems.id, failure.id));
    assert.equal((await processVoiceQueue(injection)).processed, 0);
    assert.equal((await readRun(next))!.items[0].status, "failed");
    const pilot = randomUUID();
    const preview = chooseProducts((await voiceDashboard()).products, "pilot", []).map(p => p.id);
    await assert.rejects(createRun(pilot, "pilot", preview.slice(1), 1));
    await createRun(pilot, "pilot", preview, 1);
    assert.equal((await readRun(pilot))!.items.length, 10);
    const fresh = randomUUID();
    const newProducts = chooseProducts((await voiceDashboard()).products, "new", []).map(p => p.id);
    await createRun(fresh, "new", newProducts, 1);
    assert.ok(!(await readRun(fresh))!.items.some(i => ids.includes(i.productId)));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
