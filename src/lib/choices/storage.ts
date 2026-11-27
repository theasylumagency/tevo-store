import { cleanChoiceIds, MAX_COMPARE, MAX_SAVED, type ChoiceIdentity } from "./types";

export interface ChoiceSelection {
  savedIds: string[];
  comparedIds: string[];
}

export interface ChoiceSnapshot extends ChoiceSelection {
  /** False means that the current selection is kept only in this page session. */
  persistent: boolean;
}

export const EMPTY_CHOICE_SNAPSHOT: ChoiceSnapshot = {
  savedIds: [], comparedIds: [], persistent: true,
};

export type ChoiceStorageEvent = { key: string | null; newValue: string | null };
export interface ChoiceStorageAdapter {
  read(key: string): string | null;
  write(key: string, value: string): void;
  subscribe(listener: (event: ChoiceStorageEvent) => void): () => void;
}

const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, index) => id === b[index]);

export function parseChoiceSelection(raw: string | null): ChoiceSelection {
  if (!raw) return { savedIds: [], comparedIds: [] };
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return { savedIds: [], comparedIds: [] };
    const candidate = value as Record<string, unknown>;
    if (candidate.version !== 1) return { savedIds: [], comparedIds: [] };
    return {
      savedIds: cleanChoiceIds(candidate.savedIds, MAX_SAVED),
      comparedIds: cleanChoiceIds(candidate.comparedIds, MAX_COMPARE),
    };
  } catch {
    return { savedIds: [], comparedIds: [] };
  }
}

export function choiceStorageKey(storeId: string) {
  return `choices:${storeId}:v1`;
}

/** Browser dependencies are injected so denied storage and tab changes are testable. */
export function createChoiceStore(key: string, adapter: ChoiceStorageAdapter) {
  let snapshot = EMPTY_CHOICE_SNAPSHOT;
  let loaded = false;
  let unsubscribeStorage: (() => void) | undefined;
  const listeners = new Set<() => void>();

  function setSnapshot(next: ChoiceSelection, persistent: boolean) {
    if (sameIds(snapshot.savedIds, next.savedIds) && sameIds(snapshot.comparedIds, next.comparedIds)
      && snapshot.persistent === persistent) return false;
    snapshot = {
      savedIds: sameIds(snapshot.savedIds, next.savedIds) ? snapshot.savedIds : next.savedIds,
      comparedIds: sameIds(snapshot.comparedIds, next.comparedIds) ? snapshot.comparedIds : next.comparedIds,
      persistent,
    };
    return true;
  }

  function getSnapshot(): ChoiceSnapshot {
    if (!loaded) {
      loaded = true;
      try { setSnapshot(parseChoiceSelection(adapter.read(key)), true); }
      catch { setSnapshot(snapshot, false); }
    }
    return snapshot;
  }

  function emit() { listeners.forEach((listener) => listener()); }

  function receive(event: ChoiceStorageEvent) {
    if (event.key !== null && event.key !== key) return;
    // A failed write must not replace this session's newer selection with old
    // persistent data. A later successful local mutation resumes persistence.
    if (!getSnapshot().persistent) return;
    // A queued event can describe an older write than this tab's last mutation.
    // Reconcile against storage now, including after a queued remove/clear event.
    try {
      if (setSnapshot(parseChoiceSelection(adapter.read(key)), true)) emit();
    } catch {
      if (setSnapshot(snapshot, false)) emit();
    }
  }

  return {
    getSnapshot,
    getServerSnapshot: () => EMPTY_CHOICE_SNAPSHOT,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) {
        unsubscribeStorage = adapter.subscribe(receive);
        // Close the render-to-subscribe race: a second tab could write between
        // the first snapshot and installation of the storage event listener.
        if (getSnapshot().persistent) {
          try {
            if (setSnapshot(parseChoiceSelection(adapter.read(key)), true)) emit();
          } catch {
            if (setSnapshot(snapshot, false)) emit();
          }
        }
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) { unsubscribeStorage?.(); unsubscribeStorage = undefined; }
      };
    },
    update(change: (current: ChoiceSnapshot) => ChoiceSelection | null) {
      const previous = getSnapshot();
      // Storage events are asynchronous. Re-read before an explicit mutation so
      // a tab's queued event cannot cause an avoidable overwrite of newer IDs.
      if (snapshot.persistent) {
        try { setSnapshot(parseChoiceSelection(adapter.read(key)), true); }
        catch { setSnapshot(snapshot, false); }
      }
      const changed = change(snapshot);
      if (changed === null) {
        if (snapshot !== previous) emit();
        return snapshot;
      }
      const next = {
        savedIds: cleanChoiceIds(changed.savedIds, MAX_SAVED),
        comparedIds: cleanChoiceIds(changed.comparedIds, MAX_COMPARE),
      };
      let persistent = true;
      try { adapter.write(key, JSON.stringify({ version: 1, ...next })); }
      catch { persistent = false; }
      setSnapshot(next, persistent);
      if (snapshot !== previous) emit();
      return snapshot;
    },
  };
}

export type ComparisonBlock = "unknown" | "different_type" | "full" | null;

/** The catalog decides product type; browser storage is never its authority. */
export function comparisonBlock(
  productId: string,
  selectedIds: readonly string[],
  products: readonly ChoiceIdentity[],
): ComparisonBlock {
  if (selectedIds.includes(productId)) return null;
  const productTypes = new Map(products.map((product) => [product.id, product.productType]));
  const type = productTypes.get(productId);
  if (!type) return "unknown";
  if (selectedIds.some((id) => {
    const selectedType = productTypes.get(id);
    return selectedType !== undefined && selectedType !== type;
  })) return "different_type";
  if (selectedIds.length >= MAX_COMPARE) return "full";
  return null;
}

/** An explicit replacement is atomic: incompatible input never clears the old choice. */
export function replacementBlock(ids: readonly string[], products: readonly ChoiceIdentity[]): ComparisonBlock {
  if (ids.length > MAX_COMPARE) return "full";
  const selected: string[] = [];
  for (const id of ids) {
    const blocked = comparisonBlock(id, selected, products);
    if (blocked) return blocked;
    if (!selected.includes(id)) selected.push(id);
  }
  return null;
}
