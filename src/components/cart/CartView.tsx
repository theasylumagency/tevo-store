"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { quoteAction } from "@/app/actions/checkout";
import { OrderTotals } from "@/components/OrderTotals";
import { PackageIcon } from "@/components/StoreIcons";
import ui from "@/components/storefront/foundation.module.css";
import type { Quote } from "@/lib/orders/quote";
import { formatTetri, toTetri } from "@/lib/money";
import { t, type MessageKey } from "@/i18n";
import { useCart, type CartItem } from "./CartProvider";
import { cartCopy } from "./cartCopy";
import { EmptyCart, PurchaseLoading } from "./PurchaseStates";
import styles from "./purchase.module.css";

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
      setNotes((previous) => [...new Set([...previous.filter((note) => note !== "cart.problem.no_price" && note !== "cart.problem.stock_unconfirmed"), ...n])]);
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
  const stockPending = Boolean(quote?.problems.some((p) => p.kind === "stock_unconfirmed"));
  const canCheckout = !loading && !failed && Boolean(quote?.lines.length) && !pricePending && !stockPending;

  return { quote, notes, loading, failed, retry, canCheckout, pricePending, stockPending };
}

export function Totals({ quote, delivery }: { quote: Quote; delivery?: "pickup" | "delivery" }) {
  return <OrderTotals subtotal={quote.subtotal} deliveryFee={quote.deliveryFee} deliveryMethod={delivery} presentation="storefront" />;
}

export function QuoteFeedback({ loading, failed, retry }: { loading: boolean; failed: boolean; retry: () => void }) {
  if (failed) {
    return <div role="alert" className={`${ui.notice} ${styles.feedback} ${styles.warning}`}>
      <p>{cartCopy.quoteFailed}</p>
      <button type="button" onClick={retry} className={ui.secondaryAction}>{cartCopy.retry}</button>
    </div>;
  }
  return loading ? <p role="status" className={styles.loadingNote}>{cartCopy.checking}</p> : null;
}

/** Product media is decorative here; the adjacent name is the accessible product link. */
export function CartThumbnail({ image, sizes = "88px" }: { image: string | null; sizes?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  return <div className={styles.thumbnail}>
    {image && failed !== image
      ? <Image src={image} alt="" fill sizes={sizes} onError={() => setFailed(image)} />
      : <PackageIcon size={28} />}
  </div>;
}

export function CartView({ maxQuantity = 20 }: { maxQuantity?: number }) {
  const cart = useCart();
  const { quote, notes, loading, failed, retry, canCheckout, pricePending, stockPending } = useQuote();
  const [removed, setRemoved] = useState<{ item: CartItem; index: number } | null>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const productLinks = useRef(new Map<string, HTMLAnchorElement>());

  function remove(item: CartItem, index: number) {
    setRemoved({ item, index });
    cart.remove(item.productId);
    requestAnimationFrame(() => undoRef.current?.focus());
  }

  function undoRemove() {
    if (!removed) return;
    const item = removed.item;
    const existing = cart.items.find((current) => current.productId === item.productId);
    if (existing) cart.setQty(item.productId, Math.min(maxQuantity, existing.qty + item.qty));
    else {
      const next = [...cart.items];
      next.splice(Math.min(removed.index, next.length), 0, { ...item, qty: Math.min(maxQuantity, item.qty) });
      cart.replace(next);
    }
    setRemoved(null);
    requestAnimationFrame(() => productLinks.current.get(item.productId)?.focus());
  }

  if (!cart.ready) return <PurchaseLoading />;

  return (
    <div className={styles.cartBody}>
      {(removed || notes.length > 0) && <div className={styles.notices}>
        {removed && <div className={`${ui.notice} ${styles.undo}`}>
          <p role="status">კალათიდან წაიშალა: {removed.item.name}</p>
          <button ref={undoRef} type="button" onClick={undoRemove} className={ui.secondaryAction}>დაბრუნება</button>
        </div>}
        <div className={styles.notices} aria-live="polite">{notes.map((n) => <p key={n} className={ui.notice}>{t(n)}</p>)}</div>
      </div>}
      {!cart.items.length ? <EmptyCart /> : <div className={styles.purchaseGrid}>
        <section className={styles.cartBody} aria-labelledby="cart-products-heading">
          <div className={styles.listHeading}>
            <h2 id="cart-products-heading" className={ui.sectionTitle}>არჩეული პროდუქტები</h2>
            <p>{cart.items.length} დასახელება · {cart.count} ერთეული</p>
          </div>
          <ul className={styles.cartList}>
            {cart.items.map((item, index) => (
              <li key={item.productId} className={styles.cartLine} data-testid="cart-line">
                <Link href={`/p/${item.slug}`} tabIndex={-1} aria-hidden="true" className={styles.cartImage}>
                  <CartThumbnail image={item.image} />
                </Link>
                <div className={styles.productInfo}>
                  <Link href={`/p/${item.slug}`} className={styles.productName}
                    ref={(node) => { if (node) productLinks.current.set(item.productId, node); else productLinks.current.delete(item.productId); }}>{item.name}</Link>
                  <p className={styles.unitPrice}>{item.price !== null ? `${formatTetri(toTetri(item.price))} / ერთეული` : t("price.on_request")}</p>
                  {quote?.problems.some(p => p.productId === item.productId && p.kind === "stock_unconfirmed") && <p className={styles.priceIssue}>მარაგი დასაზუსტებელია. <Link href="/info/contact" className="underline underline-offset-4">დაგვიკავშირდით</Link></p>}
                  {item.price === null && <p className={styles.priceIssue}>ფასის დაზუსტებამდე ამ პროდუქტით შეკვეთა ვერ გაფორმდება. <Link href="/info/contact" className="underline underline-offset-4">დაგვიკავშირდით</Link></p>}
                </div>
                <div className={styles.quantity} role="group" aria-label={`${t("cart.qty")}: ${item.name}`}>
                  <button type="button" aria-disabled={item.qty <= 1} onClick={() => { if (item.qty > 1) cart.setQty(item.productId, item.qty - 1); }} aria-label={`რაოდენობის შემცირება: ${item.name}`}>−</button>
                  <input type="number" inputMode="numeric" min={1} max={maxQuantity} step={1} value={item.qty} aria-label={`${t("cart.qty")}: ${item.name}`}
                    onChange={(event) => cart.setQty(item.productId, Math.max(1, Math.min(maxQuantity, Math.trunc(Number(event.target.value)) || 1)))} />
                  <button type="button" aria-disabled={item.qty >= maxQuantity} onClick={() => { if (item.qty < maxQuantity) cart.setQty(item.productId, item.qty + 1); }} aria-label={`რაოდენობის გაზრდა: ${item.name}`}>+</button>
                </div>
                <p className={styles.lineTotal}><span className={styles.lineTotalLabel}>პროდუქტის ჯამი</span>{item.price !== null ? formatTetri(toTetri(item.price) * item.qty) : "დასაზუსტებელია"}</p>
                <button type="button" onClick={() => remove(item, index)} aria-label={`${t("cart.remove")}: ${item.name}`} className={styles.remove}>{t("cart.remove")}</button>
              </li>
            ))}
          </ul>
          <Link href="/search" className={`${ui.quietAction} ${styles.continueLink}`}>{t("cart.continue")}</Link>
        </section>
        <aside className={styles.summary} aria-labelledby="cart-summary-heading">
          <h2 id="cart-summary-heading" className={styles.summaryTitle}>შეკვეთის შეჯამება</h2>
          <QuoteFeedback loading={loading} failed={failed} retry={retry} />
          {quote && !pricePending && <Totals quote={quote} />}
          {pricePending && <p className={`${ui.notice} ${styles.warning}`}>ერთ ან რამდენიმე პროდუქტს ფასი დასაზუსტებელი აქვს. გადაამოწმეთ მონიშნული პროდუქტები.</p>}
          {stockPending && <p className={`${ui.notice} ${styles.warning}`} data-testid="stock-pending">მარაგის დაზუსტებამდე შეკვეთა ვერ გაფორმდება. არჩევანი კალათაში შენახულია. <Link href="/request" className="underline underline-offset-4">ხელმისაწვდომობის დაზუსტება</Link></p>}
          {canCheckout ? <Link href="/checkout" data-testid="go-checkout" className={`${ui.primaryAction} ${styles.summaryAction}`}>
            {t("cart.checkout")}
          </Link> : <button type="button" disabled data-testid="go-checkout" className={`${ui.primaryAction} ${styles.summaryAction}`}>{t("cart.checkout")}</button>}
          <Link href="/request" className={`${ui.secondaryAction} ${styles.summaryAction}`} data-testid="request-cart-offer">სრული პირობების დაზუსტება</Link>
          <p className={styles.summaryHint}>{cartCopy.guest}. მიღებისა და გადახდის წესს შემდეგ გვერდზე აირჩევთ.</p>
        </aside>
      </div>}
    </div>
  );
}
