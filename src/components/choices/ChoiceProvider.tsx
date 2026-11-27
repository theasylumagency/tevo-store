"use client";

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { cleanChoiceIds, MAX_SAVED, type ChoiceIdentity } from "@/lib/choices/types";
import { choiceStorageKey, comparisonBlock, createChoiceStore, replacementBlock, type ComparisonBlock } from "@/lib/choices/storage";

export interface ChoiceActionResult { ok: boolean; message: string }

interface ChoiceApi {
  ready: boolean;
  savedIds: string[];
  comparedIds: string[];
  persistent: boolean;
  message: string;
  toggleSaved(id: string): ChoiceActionResult;
  toggleCompared(id: string): ChoiceActionResult;
  removeSaved(id: string): void;
  removeCompared(id: string): void;
  clearCompared(): void;
  replaceCompared(ids: string[]): ChoiceActionResult;
}

const Ctx = createContext<ChoiceApi | null>(null);
const noopSubscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

function reasonText(reason: ComparisonBlock) {
  if (reason === "different_type") return "ერთად ერთი ტიპის პროდუქტები შეადარე. არსებული არჩევანი შედარების გვერდზე შეგიძლია შეცვალო.";
  if (reason === "full") return "შედარებაში მაქსიმუმ 4 პროდუქტი თავსდება. ახლის დამატებამდე ერთ-ერთი ამოიღე.";
  return "ეს პროდუქტი მიმდინარე კატალოგში აღარ ჩანს. შედარებაში სხვა პროდუქტი აირჩიე.";
}

export function ChoiceProvider({ storeId, products, children }: {
  storeId: string;
  products: ChoiceIdentity[];
  children: ReactNode;
}) {
  const store = useMemo(() => createChoiceStore(choiceStorageKey(storeId), {
    read: (key) => window.localStorage.getItem(key),
    write: (key, value) => window.localStorage.setItem(key, value),
    subscribe: (listener) => {
      const onStorage = (event: StorageEvent) => {
        // Session-storage events must not overwrite a local selection.
        try { if (event.storageArea && event.storageArea !== window.localStorage) return; }
        catch { return; }
        listener({ key: event.key, newValue: event.newValue });
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    },
  }), [storeId]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const ready = useSyncExternalStore(noopSubscribe, clientReady, serverReady);
  const [announcement, setAnnouncement] = useState({ serial: 0, message: "" });
  const announce = useCallback((ok: boolean, message: string): ChoiceActionResult => {
    setAnnouncement((previous) => ({ serial: previous.serial + 1, message }));
    return { ok, message };
  }, []);

  const api = useMemo<ChoiceApi>(() => ({
    ready, ...snapshot, message: announcement.message,
    toggleSaved: (id) => {
      let result: ChoiceActionResult = { ok: true, message: "" };
      store.update((current) => {
        const selected = current.savedIds.includes(id);
        if (!selected && !products.some((product) => product.id === id)) {
          result = { ok: false, message: "ეს პროდუქტი მიმდინარე კატალოგში აღარ ჩანს." };
          return null;
        }
        if (!selected && current.savedIds.length >= MAX_SAVED) {
          result = { ok: false, message: "შენახულში მაქსიმუმ 50 პროდუქტი ინახება. ახლის შენახვამდე ერთ-ერთი ამოიღე." };
          return null;
        }
        result.message = selected ? "პროდუქტი შენახულიდან ამოღებულია." : "პროდუქტი შენახულში დაემატა.";
        return { ...current, savedIds: selected
          ? current.savedIds.filter((value) => value !== id) : [...current.savedIds, id] };
      });
      return announce(result.ok, result.message);
    },
    toggleCompared: (id) => {
      let result: ChoiceActionResult = { ok: true, message: "" };
      store.update((current) => {
        const selected = current.comparedIds.includes(id);
        const blocked = comparisonBlock(id, current.comparedIds, products);
        if (blocked) { result = { ok: false, message: reasonText(blocked) }; return null; }
        result.message = selected ? "პროდუქტი შედარებიდან ამოღებულია." : "პროდუქტი შედარებაში დაემატა.";
        return { ...current, comparedIds: selected
          ? current.comparedIds.filter((value) => value !== id) : [...current.comparedIds, id] };
      });
      return announce(result.ok, result.message);
    },
    removeSaved: (id) => {
      store.update((current) => ({ ...current, savedIds: current.savedIds.filter((value) => value !== id) }));
      announce(true, "პროდუქტი შენახულიდან ამოღებულია.");
    },
    removeCompared: (id) => {
      store.update((current) => ({ ...current, comparedIds: current.comparedIds.filter((value) => value !== id) }));
      announce(true, "პროდუქტი შედარებიდან ამოღებულია.");
    },
    clearCompared: () => {
      store.update((current) => ({ ...current, comparedIds: [] }));
      announce(true, "შედარების სია გასუფთავებულია.");
    },
    replaceCompared: (ids) => {
      const normalized = cleanChoiceIds(ids, MAX_SAVED);
      if (ids.length > 0 && normalized.length === 0) return announce(false, reasonText("unknown"));
      const blocked = replacementBlock(normalized, products);
      if (blocked) return announce(false, reasonText(blocked));
      store.update((current) => ({ ...current, comparedIds: normalized }));
      return announce(true, "პროდუქტები შენს შედარებაში შენახულია.");
    },
  }), [ready, snapshot, announcement.message, store, products, announce]);

  return <Ctx.Provider value={api}>
    {children}
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      <span key={announcement.serial}>{announcement.message}</span>
    </div>
  </Ctx.Provider>;
}

export function useOptionalChoices() { return useContext(Ctx); }

export function useChoices() {
  const choices = useOptionalChoices();
  if (!choices) throw new Error("useChoices outside ChoiceProvider");
  return choices;
}
