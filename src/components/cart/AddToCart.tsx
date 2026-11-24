"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart, type CartItem } from "./CartProvider";
import { t } from "@/i18n";

export function AddToCart({ item, disabled }: { item: Omit<CartItem, "qty">; disabled?: boolean }) {
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  return (
    <div className="mt-4 space-y-2">
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="qty">{t("cart.qty")}</label>
        <input id="qty" type="number" min={1} max={20} value={qty} disabled={disabled}
               onChange={(e) => setQty(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
               className="w-20 rounded-card border border-line bg-surface px-2 text-center" />
        <button type="button" disabled={disabled} data-testid="add-to-cart"
                onClick={() => { add(item, qty); setAdded(true); }}
                className="flex-1 rounded-card bg-accent px-4 py-3 font-medium text-accent-ink hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
          {t("product.buy")}
        </button>
      </div>
      {added && (
        <p className="text-center text-sm" role="status">
          ✓ {t("cart.added")} · <Link href="/cart" className="text-accent underline">{t("cart.view")}</Link>
        </p>
      )}
    </div>
  );
}
