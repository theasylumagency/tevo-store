import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_COMPARE, MAX_SAVED, type ChoiceIdentity } from "../src/lib/choices/types";
import {
  choiceStorageKey, comparisonBlock, createChoiceStore, parseChoiceSelection, replacementBlock,
  type ChoiceStorageAdapter, type ChoiceStorageEvent,
} from "../src/lib/choices/storage";

function storageFixture(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const listeners = new Set<(event: ChoiceStorageEvent) => void>();
  const control = { denyRead: false, denyWrite: false };
  const adapter: ChoiceStorageAdapter = {
    read(key) {
      if (control.denyRead) throw new Error("Storage blocked");
      return values.get(key) ?? null;
    },
    write(key, value) {
      if (control.denyWrite) throw new Error("Quota exceeded");
      values.set(key, value);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
  function deliverEvent(event: ChoiceStorageEvent) {
    listeners.forEach((listener) => listener(event));
  }
  function fromOtherTab(key: string | null, newValue: string | null) {
    if (key === null) values.clear();
    else if (newValue === null) values.delete(key);
    else values.set(key, newValue);
    deliverEvent({ key, newValue });
  }
  return { adapter, control, values, fromOtherTab, deliverEvent, listeners };
}

const serialize = (savedIds: string[] = [], comparedIds: string[] = []) =>
  JSON.stringify({ version: 1, savedIds, comparedIds });

test("selection storage rejects corrupt and wrong-version shapes, validates IDs and keeps unknown IDs for recovery", () => {
  for (const raw of [null, "", "{", "null", "[]", "{}", "42", '"string"', '{"version":2,"savedIds":["at-1"]}']) {
    assert.deepEqual(parseChoiceSelection(raw), { savedIds: [], comparedIds: [] });
  }
  assert.deepEqual(parseChoiceSelection(JSON.stringify({
    version: 1,
    savedIds: ["at-1", "at-1", null, 4, {}, "", "../secret", "a".repeat(65), "unpublished-id"],
    comparedIds: { id: "at-1" },
  })), { savedIds: ["at-1", "unpublished-id"], comparedIds: [] });
  const ids = Array.from({ length: MAX_SAVED + 20 }, (_, index) => `at-${index}`);
  const parsed = parseChoiceSelection(serialize(ids, ids));
  assert.equal(parsed.savedIds.length, MAX_SAVED);
  assert.equal(parsed.comparedIds.length, MAX_COMPARE);
});

test("getSnapshot remains referentially stable until selection or persistence changes", () => {
  const fixture = storageFixture();
  const store = createChoiceStore("test", fixture.adapter);
  const initial = store.getSnapshot();
  assert.strictEqual(store.getSnapshot(), initial);
  store.update((current) => ({ ...current, savedIds: [] }));
  assert.strictEqual(store.getSnapshot(), initial);
  store.update((current) => ({ ...current, savedIds: ["at-1"] }));
  const changed = store.getSnapshot();
  assert.notStrictEqual(changed, initial);
  assert.strictEqual(store.getSnapshot(), changed);
  store.update((current) => ({ ...current, comparedIds: ["at-1"] }));
  assert.strictEqual(store.getSnapshot().savedIds, changed.savedIds);
});

test("blocked browser storage keeps successive additions in session memory", () => {
  const fixture = storageFixture();
  fixture.control.denyRead = true;
  fixture.control.denyWrite = true;
  const store = createChoiceStore("test", fixture.adapter);
  assert.equal(store.getSnapshot().persistent, false);
  let notifications = 0;
  const unsubscribe = store.subscribe(() => { notifications += 1; });
  store.update((current) => ({ ...current, savedIds: [...current.savedIds, "at-1"] }));
  store.update((current) => ({ ...current, savedIds: [...current.savedIds, "at-2"] }));
  assert.deepEqual(store.getSnapshot().savedIds, ["at-1", "at-2"]);
  assert.equal(store.getSnapshot().persistent, false);
  assert.equal(notifications, 2);
  unsubscribe();
  assert.equal(fixture.listeners.size, 0);
});

test("a quota failure preserves current session changes and can later resume persistence", () => {
  const fixture = storageFixture({ test: serialize(["at-1"]) });
  const store = createChoiceStore("test", fixture.adapter);
  store.subscribe(() => {});
  assert.deepEqual(store.getSnapshot().savedIds, ["at-1"]);
  fixture.control.denyWrite = true;
  store.update((current) => ({ ...current, savedIds: [...current.savedIds, "at-2"] }));
  fixture.fromOtherTab("test", serialize(["at-old"]));
  assert.deepEqual(store.getSnapshot().savedIds, ["at-1", "at-2"]);
  assert.equal(store.getSnapshot().persistent, false);
  fixture.control.denyWrite = false;
  store.update((current) => ({ ...current, savedIds: [...current.savedIds, "at-3"] }));
  assert.equal(store.getSnapshot().persistent, true);
  assert.deepEqual(parseChoiceSelection(fixture.values.get("test")!), { savedIds: ["at-1", "at-2", "at-3"], comparedIds: [] });
});

test("cross-tab events synchronize only the matching store and preserve stable snapshots for duplicate events", () => {
  const fixture = storageFixture();
  const first = createChoiceStore(choiceStorageKey("rodo"), fixture.adapter);
  const second = createChoiceStore(choiceStorageKey("other"), fixture.adapter);
  let notifications = 0;
  first.subscribe(() => { notifications += 1; });
  second.subscribe(() => {});
  fixture.fromOtherTab(choiceStorageKey("other"), serialize(["at-2"]));
  assert.deepEqual(first.getSnapshot().savedIds, []);
  assert.deepEqual(second.getSnapshot().savedIds, ["at-2"]);
  fixture.fromOtherTab(choiceStorageKey("rodo"), serialize(["at-1"], ["at-3"]));
  const snapshot = first.getSnapshot();
  fixture.fromOtherTab(choiceStorageKey("rodo"), serialize(["at-1"], ["at-3"]));
  assert.strictEqual(first.getSnapshot(), snapshot);
  assert.equal(notifications, 1);
  fixture.fromOtherTab(choiceStorageKey("rodo"), null);
  assert.deepEqual(first.getSnapshot().savedIds, []);
  assert.deepEqual(second.getSnapshot().savedIds, ["at-2"]);
  fixture.fromOtherTab(null, null);
  assert.deepEqual(second.getSnapshot().savedIds, []);
});

test("subscription catches a tab update between the initial render and listening", () => {
  const fixture = storageFixture();
  const store = createChoiceStore("test", fixture.adapter);
  assert.deepEqual(store.getSnapshot().savedIds, []);
  fixture.values.set("test", serialize(["at-1"]));
  let notifications = 0;
  store.subscribe(() => { notifications += 1; });
  assert.deepEqual(store.getSnapshot().savedIds, ["at-1"]);
  assert.equal(notifications, 1);
});

test("successive controls mutate the current snapshot and stored payload contains IDs only", () => {
  const fixture = storageFixture();
  const store = createChoiceStore("test", fixture.adapter);
  const add = (id: string) => store.update((current) => ({ ...current, savedIds: [...current.savedIds, id] }));
  add("at-1"); add("at-2"); add("at-1");
  store.update((current) => ({ ...current, comparedIds: ["at-2"] }));
  assert.deepEqual(JSON.parse(fixture.values.get("test")!), {
    version: 1, savedIds: ["at-1", "at-2"], comparedIds: ["at-2"],
  });
});

test("mutations preserve another tab's newer selection even before its storage event is delivered", () => {
  const fixture = storageFixture();
  const store = createChoiceStore("test", fixture.adapter);
  store.getSnapshot();
  fixture.values.set("test", serialize(["from-another-tab"]));
  store.update((current) => ({ ...current, savedIds: [...current.savedIds, "from-this-tab"] }));
  assert.deepEqual(store.getSnapshot().savedIds, ["from-another-tab", "from-this-tab"]);
  fixture.values.set("test", serialize(["latest-from-other-tab"]));
  store.update(() => null);
  assert.deepEqual(store.getSnapshot().savedIds, ["latest-from-other-tab"]);
  assert.deepEqual(parseChoiceSelection(fixture.values.get("test")!).savedIds, ["latest-from-other-tab"]);
});

test("queued storage events cannot revert a newer local mutation or a post-clear selection", () => {
  const fixture = storageFixture();
  const store = createChoiceStore("test", fixture.adapter);
  let notifications = 0;
  store.subscribe(() => { notifications += 1; });
  const queuedWrite = serialize(["from-another-tab"]);
  fixture.values.set("test", queuedWrite);
  store.update((current) => ({ ...current, savedIds: [...current.savedIds, "from-this-tab"] }));
  const latest = store.getSnapshot();
  fixture.deliverEvent({ key: "test", newValue: queuedWrite });
  assert.strictEqual(store.getSnapshot(), latest);
  assert.deepEqual(store.getSnapshot().savedIds, ["from-another-tab", "from-this-tab"]);
  assert.equal(notifications, 1);

  fixture.values.clear();
  store.update((current) => ({ ...current, savedIds: [...current.savedIds, "after-clear"] }));
  const afterClear = store.getSnapshot();
  fixture.deliverEvent({ key: null, newValue: null });
  fixture.deliverEvent({ key: "test", newValue: null });
  assert.strictEqual(store.getSnapshot(), afterClear);
  assert.deepEqual(store.getSnapshot().savedIds, ["after-clear"]);
  assert.equal(notifications, 2);
});

test("storage-event read failures preserve the current selection as a session fallback", () => {
  const fixture = storageFixture({ test: serialize(["current"], ["compared"]) });
  const store = createChoiceStore("test", fixture.adapter);
  store.subscribe(() => {});
  fixture.control.denyRead = true;
  fixture.deliverEvent({ key: "test", newValue: serialize(["older-event"]) });
  assert.deepEqual(store.getSnapshot(), { savedIds: ["current"], comparedIds: ["compared"], persistent: false });
  fixture.control.denyRead = false;
  fixture.deliverEvent({ key: "test", newValue: null });
  assert.deepEqual(store.getSnapshot().savedIds, ["current"]);
});

test("comparison limits and product types use the current catalog and never prevent removing a selected item", () => {
  const products: ChoiceIdentity[] = [
    ...Array.from({ length: 5 }, (_, index) => ({ id: `m-${index}`, productType: "MOTOBLOCK" })),
    { id: "pump", productType: "WATER_PUMP" },
  ];
  assert.equal(comparisonBlock("m-1", ["m-0"], products), null);
  assert.equal(comparisonBlock("pump", ["m-0"], products), "different_type");
  assert.equal(comparisonBlock("missing", [], products), "unknown");
  assert.equal(comparisonBlock("m-4", ["m-0", "m-1", "m-2", "m-3"], products), "full");
  assert.equal(comparisonBlock("m-0", ["m-0", "m-1", "m-2", "m-3"], products), null);
  assert.equal(comparisonBlock("unpublished", ["unpublished", "pump"], products), null);
  assert.equal(comparisonBlock("m-1", ["unpublished"], products), null);
  assert.equal(comparisonBlock("pump", ["m-0"], products.map((product) => product.id === "m-0" ? { ...product, productType: "WATER_PUMP" } : product)), null);
  assert.equal(replacementBlock(["m-0", "pump"], products), "different_type");
  assert.equal(replacementBlock(["missing"], products), "unknown");
  assert.equal(replacementBlock(["m-0", "m-1", "m-2", "m-3", "m-4"], products), "full");
  assert.equal(replacementBlock(["m-0", "m-1"], products), null);
});
