"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { quoteAction } from "@/app/actions/checkout";
import type { Quote } from "@/lib/orders/quote";
import { formatTetri, toTetri } from "@/lib/money";
import { t, type MessageKey } from "@/i18n";
import { useCart } from "./CartProvider";

/** Re-quotes the cart on the server and reconciles the browser copy (price changes, removed products). */
export function useQuote() {
  const cart = useCart();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [notes, setNotes] = useState<MessageKey[]>([]);
  const sig = cart.items.map((i) => `${i.productId}:${i.qty}`).join("|");

  useEffect(() => {
    if (!cart.ready) return;
    let alive = true;
    quoteAction(cart.items.map((i) => ({ productId: i.productId, qty: i.qty }))).then((q) => {
      if (!alive) return;
      setQuote(q);
      const n = new Set<MessageKey>(q.problems.map((p) => `cart.problem.${p.kind}` as MessageKey));
      const byId = new Map(q.lines.map((l) => [l.productId, l]));
      const unavailable = new Set(q.problems.filter((p) => p.kind === "unavailable").map((p) => p.productId));
      let changed = unavailable.size > 0;
      const next = cart.items.filter((i) => !unavailable.has(i.productId)).map((i) => {
        const l = byId.get(i.productId);
        if (!l) return i;
        if (i.price !== null && toTetri(i.price) !== l.unitPrice) { n.add("cart.problem.price_changed"); changed = true; }
        if (l.qty !== i.qty) changed = true;
        return { ...i, price: l.unitPrice / 100, qty: l.qty, name: l.name };
      });
      if (changed) cart.replace(next);
      setNotes([...n]);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.ready, sig]);

  return { quote, notes };
}

export function Totals({ quote, delivery }: { quote: Quote; delivery?: "pickup" | "delivery" }) {
  const fee = delivery === "pickup" ? 0 : quote.deliveryFee;
  return (
    <dl className="space-y-1 text-sm">
      <div className="flex justify-between"><dt className="text-ink-2">{t("cart.subtotal")}</dt><dd>{formatTetri(quote.subtotal)}</dd></div>
      <div className="flex justify-between">
        <dt className="text-ink-2">{t("cart.delivery")}</dt>
        <dd>{fee === null ? t("cart.delivery.by_phone") : fee === 0 ? t("cart.delivery.free") : formatTetri(fee)}</dd>
      </div>
      <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
        <dt>{t("cart.total")}</dt><dd className="text-accent" data-testid="cart-total">{formatTetri(quote.subtotal + (fee ?? 0))}</dd>
      </div>
    </dl>
  );
}

export function CartView() {
  const cart = useCart();
  const { quote, notes } = useQuote();
  if (cart.ready && !cart.items.length) {
    return (
      <div className="rounded-card border border-dashed border-line p-10 text-center">
        <p className="text-ink-2">{t("cart.empty")}</p>
        <Link href="/" className="mt-3 inline-block text-accent">{t("cart.continue")}</Link>
      </div>
    );
  }
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        {notes.map((n) => <p key={n} className="rounded-card bg-warn-soft px-3 py-2 text-sm text-warn">{t(n)}</p>)}
        <ul className="divide-y divide-line rounded-card border border-line bg-surface">
          {cart.items.map((i) => (
            <li key={i.productId} className="flex items-center gap-4 p-3" data-testid="cart-line">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded border border-line bg-white">
                {i.image && <Image src={i.image} alt="" fill sizes="64px" className="object-contain p-1" />}
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/p/${i.slug}`} className="line-clamp-2 font-medium hover:text-accent">{i.name}</Link>
                <p className="text-sm text-ink-2">{i.price !== null ? formatTetri(toTetri(i.price)) : "—"}</p>
              </div>
              <input type="number" min={1} max={20} value={i.qty} aria-label={t("cart.qty")}
                     onChange={(e) => cart.setQty(i.productId, Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                     className="w-16 rounded border border-line px-2 py-1 text-center" />
              <button onClick={() => cart.remove(i.productId)} className="text-sm text-ink-2 hover:text-warn">{t("cart.remove")}</button>
            </li>
          ))}
        </ul>
      </div>
      <aside className="h-fit space-y-4 rounded-card border border-line bg-surface p-4">
        {quote ? <Totals quote={quote} /> : <div className="h-20 animate-pulse rounded bg-line/40" />}
        <Link href="/checkout" data-testid="go-checkout"
              className="block rounded-card bg-accent px-4 py-3 text-center font-medium text-accent-ink hover:opacity-90">
          {t("cart.checkout")}
        </Link>
      </aside>
    </div>
  );
}
