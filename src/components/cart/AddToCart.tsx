"use client";

import Link from "next/link";
import { useId, useLayoutEffect, useState } from "react";
import { useCart, type CartItem } from "./CartProvider";
import { productQuantity } from "@/lib/catalog/product-presentation";
import { productCopy } from "@/i18n/product";
import { t } from "@/i18n";
import ui from "../storefront/foundation.module.css";
import styles from "../product.module.css";

export function AddToCart({ item, disabled, disabledDescriptionId, maxQuantity = 20 }: {
  item: Omit<CartItem, "qty">;
  disabled?: boolean;
  disabledDescriptionId?: string;
  maxQuantity?: number;
}) {
  const { add, items, ready } = useCart();
  const [qty, setQty] = useState("1");
  const [added, setAdded] = useState(0);
  const inputId = useId();
  const capacityId = useId();
  const inCart = items.find((line) => line.productId === item.productId)?.qty ?? 0;
  const remaining = Math.max(0, maxQuantity - inCart);
  const quantity = productQuantity(qty, remaining);
  const blocked = disabled || !ready || remaining === 0;
  const descriptionId = disabled ? disabledDescriptionId : remaining === 0 ? capacityId : undefined;

  // Next preserves route state; an old success message should not reopen on Back.
  useLayoutEffect(() => () => setAdded(0), []);

  return (
    <div className={styles.addToCart} aria-busy={!ready}>
      <div className={styles.quantityRow}>
        <label htmlFor={inputId}>{productCopy.quantity}</label>
        <div className={styles.quantityControl}>
          <button type="button" aria-label={productCopy.decrease} disabled={blocked} aria-disabled={quantity <= 1 || undefined}
            onClick={() => { if (blocked || quantity <= 1) return; setQty(String(quantity - 1)); setAdded(0); }}>−</button>
          <input id={inputId} type="number" inputMode="numeric" min={1} max={Math.max(1, remaining)} step={1}
            value={qty === "" ? "" : productQuantity(qty, Math.max(1, remaining))} disabled={blocked}
            aria-describedby={descriptionId}
            onChange={(event) => { setQty(event.target.value); setAdded(0); }}
            onBlur={() => setQty(String(productQuantity(qty, Math.max(1, remaining))))} />
          <button type="button" aria-label={productCopy.increase} disabled={blocked} aria-disabled={quantity >= remaining || undefined}
            onClick={() => { if (blocked || quantity >= remaining) return; setQty(String(quantity + 1)); setAdded(0); }}>+</button>
        </div>
      </div>
      <button type="button" disabled={disabled || !ready} aria-disabled={remaining === 0 || undefined}
        data-testid="add-to-cart" className={ui.primaryAction}
        aria-describedby={descriptionId}
        onClick={() => {
          if (blocked || quantity < 1) return;
          add(item, quantity);
          setAdded(quantity);
          setQty("1");
        }}>
        {t("product.buy")}
      </button>
      {remaining === 0 && !disabled && <p id={capacityId} className={styles.capacity} role="status">{productCopy.quantityLimit}</p>}
      <div className={styles.addFeedback} role="status" aria-atomic="true">
        {added > 0 && inCart > 0 ? <p><span aria-hidden="true">✓ </span>{productCopy.cartAdded} · {added} ც.<br />
          <span>{productCopy.alreadyInCart}: {inCart} ც.</span></p>
          : inCart > 0 && <p>{productCopy.alreadyInCart}: {inCart} ც.</p>}
      </div>
      {inCart > 0 && <Link href="/cart" className={ui.secondaryAction}>{productCopy.cartView}</Link>}
    </div>
  );
}
