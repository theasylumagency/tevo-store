"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";

/** Display snapshot only. Prices are always re-quoted on the server before an order is created. */
export interface CartItem {
  productId: string;
  slug: string;
  name: string;
  price: number | null;   // GEL, for display
  image: string | null;
  qty: number;
}

interface CartApi {
  items: CartItem[];
  ready: boolean;
  count: number;
  add: (item: Omit<CartItem, "qty">, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  replace: (items: CartItem[]) => void;
}

const Ctx = createContext<CartApi | null>(null);
const EMPTY: CartItem[] = [];

// localStorage-backed external store (shared across tabs through the "storage" event)
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; items: CartItem[] }>();

function read(key: string): CartItem[] {
  let raw: string | null = null;
  try { raw = localStorage.getItem(key); } catch { /* storage unavailable */ }
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.items;
  let items = EMPTY;
  try { items = raw ? (JSON.parse(raw) as CartItem[]) : EMPTY; } catch { items = EMPTY; }
  cache.set(key, { raw, items });
  return items;
}

function write(key: string, items: CartItem[]) {
  try { localStorage.setItem(key, JSON.stringify(items)); } catch { /* storage unavailable */ }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => { listeners.delete(cb); window.removeEventListener("storage", cb); };
}

const noop = () => () => {};

export function CartProvider({ storeId, children }: { storeId: string; children: React.ReactNode }) {
  const key = `cart:${storeId}`;
  const items = useSyncExternalStore(subscribe, () => read(key), () => EMPTY);
  const ready = useSyncExternalStore(noop, () => true, () => false);
  const persist = useCallback((next: CartItem[]) => write(key, next), [key]);

  const api = useMemo<CartApi>(() => ({
    items, ready,
    count: items.reduce((s, i) => s + i.qty, 0),
    add: (item, qty = 1) => {
      const found = items.find((i) => i.productId === item.productId);
      persist(found ? items.map((i) => (i.productId === item.productId ? { ...i, ...item, qty: i.qty + qty } : i))
                    : [...items, { ...item, qty }]);
    },
    setQty: (id, qty) => persist(qty <= 0 ? items.filter((i) => i.productId !== id)
                                          : items.map((i) => (i.productId === id ? { ...i, qty } : i))),
    remove: (id) => persist(items.filter((i) => i.productId !== id)),
    clear: () => persist([]),
    replace: (next) => persist(next),
  }), [items, ready, persist]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart outside CartProvider");
  return c;
}
