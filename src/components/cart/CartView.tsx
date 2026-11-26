"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { quoteAction } from "@/app/actions/checkout";
import { OrderTotals } from "@/components/OrderTotals";
import type { Quote } from "@/lib/orders/quote";
import { formatTetri, toTetri } from "@/lib/money";
import { t, type MessageKey } from "@/i18n";
import { useCart } from "./CartProvider";
import { cartCopy } from "./cartCopy";

interface QuoteResult {
  signature: string;
  attempt: number;
  checkoutQuote?: Quote;
  quote: Quote | null;
  failed: boolean;
}

/** Re-quotes the cart on the server and reconciles the browser copy (price changes, removed products). */
export function useQuote(checkoutQuote?: Quote) {
  const cart = useCart();
  const [result, setResult] = useState<QuoteResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [notes, setNotes] = useState<MessageKey[]>([]);
  const sig = cart.items.map((i) => `${i.productId}:${i.qty}`).join("|");
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    if (!cart.ready) return;
    let alive = true;
    const context = { signature: sig, attempt, checkoutQuote };
    // Server Actions cannot be aborted; ignore late responses after a timeout or cart change.
    const timeout = window.setTimeout(() => {
      if (!alive) return;
      alive = false;
      setResult({ ...context, quote: null, failed: true });
    }, 20_000);
    quoteAction(cart.items.map((i) => ({ productId: i.productId, qty: i.qty }))).then((q) => {
      window.clearTimeout(timeout);
      if (!alive) return;
      setResult({ ...context, quote: q, failed: false });
      const n = new Set<MessageKey>(q.problems.map((p) => `cart.problem.${p.kind}` as MessageKey));
      const byId = new Map(q.lines.map((l) => [l.productId, l]));
      const unavailable = new Set(q.problems.filter((p) => p.kind === "unavailable").map((p) => p.productId));
      const unpriced = new Set(q.problems.filter((p) => p.kind === "no_price").map((p) => p.productId));
      let changed = unavailable.size > 0;
      const next = cart.items.filter((i) => !unavailable.has(i.productId)).map((i) => {
        if (unpriced.has(i.productId)) {
          if (i.price !== null) changed = true;
          return { ...i, price: null };
        }
        const l = byId.get(i.productId);
        if (!l) return i;
        if (i.price !== null && toTetri(i.price) !== l.unitPrice) { n.add("cart.problem.price_changed"); changed = true; }
        if (i.price === null || l.qty !== i.qty || l.name !== i.name) changed = true;
        return { ...i, price: l.unitPrice / 100, qty: l.qty, name: l.name };
      });
      if (changed) cart.replace(next);
      // Keep change notices visible when reconciliation itself triggers another quote.
      setNotes((previous) => [...new Set([...previous.filter((note) => note !== "cart.problem.no_price"), ...n])]);
    }).catch(() => {
      window.clearTimeout(timeout);
      if (alive) setResult({ ...context, quote: null, failed: true });
    });
    return () => { alive = false; window.clearTimeout(timeout); };
    // Quantity/identity changes and a cart_changed response invalidate the current quote.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.ready, sig, attempt, checkoutQuote]);

  const current = result?.signature === sig && result.attempt === attempt && result.checkoutQuote === checkoutQuote;
  const quote = current ? result.quote : null;
  const failed = Boolean(current && result.failed);
  const loading = !cart.ready || (!quote && !failed);
  const pricePending = Boolean(quote?.problems.some((p) => p.kind === "no_price"));
  const canCheckout = !loading && !failed && Boolean(quote?.lines.length) && !pricePending;

  return { quote, notes, loading, failed, retry, canCheckout, pricePending };
}

export function Totals({ quote, delivery }: { quote: Quote; delivery?: "pickup" | "delivery" }) {
  return <OrderTotals subtotal={quote.subtotal} deliveryFee={quote.deliveryFee} deliveryMethod={delivery} />;
}

export function QuoteFeedback({ loading, failed, retry }: { loading: boolean; failed: boolean; retry: () => void }) {
  if (failed) {
    return <div role="alert" className="space-y-2 rounded-card bg-warn-soft p-3 text-sm text-warn">
      <p>{cartCopy.quoteFailed}</p>
      <button type="button" onClick={retry} className="min-h-11 rounded-card border border-current px-3 py-2 font-medium">{cartCopy.retry}</button>
    </div>;
  }
  return loading ? <p role="status" className="rounded-card bg-bg px-3 py-4 text-sm text-ink-2">{cartCopy.checking}</p> : null;
}

export function CartView() {
  const cart = useCart();
  const { quote, notes, loading, failed, retry, canCheckout, pricePending } = useQuote();
  if (cart.ready && !cart.items.length) {
    return (
      <div className="rounded-card border border-dashed border-line p-10 text-center">
        <p className="text-ink-2">{t("cart.empty")}</p>
        <Link href="/" className="mt-3 inline-flex min-h-11 items-center text-accent">{t("cart.continue")}</Link>
      </div>
    );
  }
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        {notes.map((n) => <p key={n} className="rounded-card bg-warn-soft px-3 py-2 text-sm text-warn">{t(n)}</p>)}
        <ul className="divide-y divide-line rounded-card border border-line bg-surface">
          {cart.items.map((i) => (
            <li key={i.productId} className="flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap" data-testid="cart-line">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded border border-line bg-white">
                {i.image && <Image src={i.image} alt="" fill sizes="64px" className="object-contain p-1" />}
              </div>
              <div className="min-w-0 flex-1 basis-[calc(100%_-_76px)] sm:basis-auto">
                <Link href={`/p/${i.slug}`} className="line-clamp-2 font-medium hover:text-accent">{i.name}</Link>
                <p className="text-sm text-ink-2">{i.price !== null ? formatTetri(toTetri(i.price)) : t("price.on_request")}</p>
              </div>
              <input type="number" inputMode="numeric" min={1} max={20} step={1} value={i.qty} aria-label={`${t("cart.qty")}: ${i.name}`}
                     onChange={(e) => cart.setQty(i.productId, Math.max(1, Math.min(20, Math.trunc(Number(e.target.value)) || 1)))}
                     className="ml-[76px] min-h-11 w-16 rounded-card border border-line px-2 py-2 text-center sm:ml-0" />
              <button type="button" onClick={() => cart.remove(i.productId)} aria-label={`${t("cart.remove")}: ${i.name}`} className="min-h-11 px-2 text-sm text-ink-2 hover:text-warn">{t("cart.remove")}</button>
            </li>
          ))}
        </ul>
      </div>
      <aside className="h-fit space-y-4 rounded-card border border-line bg-surface p-4">
        <QuoteFeedback loading={loading} failed={failed} retry={retry} />
        {quote && !pricePending && <Totals quote={quote} />}
        {canCheckout ? <Link href="/checkout" data-testid="go-checkout"
              className="block min-h-11 rounded-card bg-accent px-4 py-3 text-center font-medium text-accent-ink hover:opacity-90">
          {t("cart.checkout")}
        </Link> : <button type="button" disabled data-testid="go-checkout" className="min-h-11 w-full rounded-card bg-accent px-4 py-3 text-center font-medium text-accent-ink opacity-50">{t("cart.checkout")}</button>}
      </aside>
    </div>
  );
}
