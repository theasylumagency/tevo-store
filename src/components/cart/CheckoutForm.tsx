"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { placeOrderAction, type CheckoutState } from "@/app/actions/checkout";
import type { DeliveryMethod, PaymentMethod } from "@/config/store";
import { t, type MessageKey } from "@/i18n";
import { formatTetri } from "@/lib/money";
import { useCart } from "./CartProvider";
import { QuoteFeedback, Totals, useQuote } from "./CartView";
import { cartCopy } from "./cartCopy";

interface Props {
  paymentMethods: PaymentMethod[];
  deliveryMethods: DeliveryMethod[];
  regions: readonly string[];
  testMode: boolean;
}

export function CheckoutForm({ paymentMethods, deliveryMethods, regions, testMode }: Props) {
  const cart = useCart();
  const [state, action, pending] = useActionState<CheckoutState, FormData>(placeOrderAction, {});
  const { quote, notes, loading, failed, retry, canCheckout, pricePending } = useQuote(state.quote);
  const formRef = useRef<HTMLFormElement>(null);
  const v = state.values ?? {};
  const [delivery, setDelivery] = useState<DeliveryMethod>((v.deliveryMethod as DeliveryMethod) || deliveryMethods[0]);
  const [payment, setPayment] = useState<PaymentMethod>((v.paymentMethod as PaymentMethod) || paymentMethods[0]);

  useEffect(() => {
    if (state.ok && state.redirectUrl) {
      cart.clear();
      window.location.assign(state.redirectUrl);   // may be the bank's domain
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.redirectUrl]);

  useEffect(() => {
    if (state.fieldErrors) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    else if (state.formError) formRef.current?.querySelector<HTMLElement>("#checkout-error")?.focus();
  }, [state]);

  if (cart.ready && !cart.items.length && !state.ok) {
    return <p className="text-ink-2">{t("cart.empty")} <Link href="/" className="text-accent">{t("cart.continue")}</Link></p>;
  }

  const err = (k: string) => state.fieldErrors?.[k];
  const field = "min-h-11 w-full rounded-card border border-line bg-surface px-3 py-2 outline-none focus:border-accent aria-invalid:border-warn";
  const blocked = pending || Boolean(state.ok) || !canCheckout || !payment || !delivery;

  return (
    <form ref={formRef} action={action} onSubmit={(event) => { if (blocked) event.preventDefault(); }} className="grid gap-8 lg:grid-cols-[1fr_340px]" noValidate aria-busy={pending}>
      <input type="hidden" name="prices" value={JSON.stringify(Object.fromEntries((quote?.lines ?? []).map(l => [l.productId, l.unitPrice])))} />
      <input type="hidden" name="items" value={JSON.stringify(cart.items.map((i) => ({ productId: i.productId, qty: i.qty })))} />
      <div className="space-y-8">
        <p className="text-sm text-ink-2">{cartCopy.guest}</p>
        {state.formError && <p id="checkout-error" role="alert" tabIndex={-1} className="rounded-card bg-warn-soft px-3 py-2 text-sm text-warn">{t(state.formError)}</p>}
        {notes.map((n) => <p key={n} className="rounded-card bg-warn-soft px-3 py-2 text-sm text-warn">{t(n)}</p>)}

        <fieldset className="space-y-3" disabled={pending || Boolean(state.ok)}>
          <legend className="mb-2 text-lg font-semibold">{t("checkout.contact")}</legend>
          <label className="block"><span className="mb-1 block text-sm">{t("checkout.name")}</span>
            <input name="name" defaultValue={v.name} autoComplete="name" required aria-invalid={Boolean(err("name"))} aria-describedby={err("name") ? "checkout-name-error" : undefined} className={field} /><FieldError id="checkout-name-error" msg={err("name")} /></label>
          <label className="block"><span className="mb-1 block text-sm">{t("checkout.phone")}</span>
            <input name="phone" defaultValue={v.phone} type="tel" inputMode="tel" autoComplete="tel" placeholder="5XX XX XX XX" required aria-invalid={Boolean(err("phone"))} aria-describedby={`checkout-phone-hint${err("phone") ? " checkout-phone-error" : ""}`} className={field} />
            <span id="checkout-phone-hint" className="mt-1 block text-xs text-ink-2">{t("checkout.phone.hint")}</span><FieldError id="checkout-phone-error" msg={err("phone")} /></label>
          <label className="block"><span className="mb-1 block text-sm">{t("checkout.email")}</span>
            <input name="email" defaultValue={v.email} type="email" autoComplete="email" aria-invalid={Boolean(err("email"))} aria-describedby={err("email") ? "checkout-email-error" : undefined} className={field} /><FieldError id="checkout-email-error" msg={err("email")} /></label>
        </fieldset>

        <fieldset className="space-y-3" disabled={pending || Boolean(state.ok)}>
          <legend className="mb-2 text-lg font-semibold">{t("checkout.delivery")}</legend>
          {deliveryMethods.map((m) => (
            <label key={m} className={`flex cursor-pointer gap-3 rounded-card border p-3 ${delivery === m ? "border-accent bg-accent-soft" : "border-line bg-surface"}`}>
              <input type="radio" name="deliveryMethod" value={m} checked={delivery === m} onChange={() => setDelivery(m)} className="mt-1 accent-[var(--accent)]" />
              <span><span className="block font-medium">{t(`checkout.delivery.${m}` as MessageKey)}</span>
                <span className="text-sm text-ink-2">{t(`checkout.delivery.${m}.hint` as MessageKey)}</span></span>
            </label>
          ))}
          {delivery === "delivery" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="mb-1 block text-sm">{t("checkout.region")}</span>
                <select name="region" defaultValue={v.region} autoComplete="address-level1" required aria-invalid={Boolean(err("region"))} aria-describedby={err("region") ? "checkout-region-error" : undefined} className={field}>
                  <option value="">—</option>
                  {regions.map((r) => <option key={r} value={r}>{r}</option>)}
                </select><FieldError id="checkout-region-error" msg={err("region")} /></label>
              <label className="block"><span className="mb-1 block text-sm">{t("checkout.city")}</span>
                <input name="city" defaultValue={v.city} autoComplete="address-level2" required aria-invalid={Boolean(err("city"))} aria-describedby={err("city") ? "checkout-city-error" : undefined} className={field} /><FieldError id="checkout-city-error" msg={err("city")} /></label>
              <label className="block sm:col-span-2"><span className="mb-1 block text-sm">{t("checkout.address")}</span>
                <input name="address" defaultValue={v.address} autoComplete="street-address" required aria-invalid={Boolean(err("address"))} aria-describedby={err("address") ? "checkout-address-error" : undefined} className={field} /><FieldError id="checkout-address-error" msg={err("address")} /></label>
            </div>
          )}
          <label className="block"><span className="mb-1 block text-sm">{t("checkout.comment")}</span>
            <textarea name="comment" defaultValue={v.comment} rows={2} className={field} /></label>
        </fieldset>

        <fieldset className="space-y-3" disabled={pending || Boolean(state.ok)}>
          <legend className="mb-2 text-lg font-semibold">{t("checkout.payment")}</legend>
          {paymentMethods.map((m) => (
            <label key={m} className={`flex cursor-pointer gap-3 rounded-card border p-3 ${payment === m ? "border-accent bg-accent-soft" : "border-line bg-surface"}`}>
              <input type="radio" name="paymentMethod" value={m} checked={payment === m} onChange={() => setPayment(m)} className="mt-1 accent-[var(--accent)]" />
              <span><span className="block font-medium">{t(`checkout.payment.${m}` as MessageKey)}</span>
                <span className="text-sm text-ink-2">{t(`checkout.payment.${m}.hint` as MessageKey)}</span></span>
            </label>
          ))}
          {testMode && payment !== "cash" && <p className="text-xs text-warn">{t("checkout.test_mode")}</p>}
        </fieldset>
      </div>

      <aside className="h-fit space-y-4 rounded-card border border-line bg-surface p-4 lg:sticky lg:top-4">
        <h2 className="font-semibold">{t("checkout.summary")}</h2>
        <Link href="/cart" className="inline-flex min-h-11 items-center text-sm text-accent underline underline-offset-4">{cartCopy.reviewCart}</Link>
        <QuoteFeedback loading={loading} failed={failed} retry={retry} />
        <ul className="space-y-2 text-sm">
          {(quote?.lines ?? []).map((l) => (
            <li key={l.productId} className="flex justify-between gap-3">
              <span className="min-w-0 flex-1">{l.name} <span className="text-ink-2">× {l.qty}</span></span>
              <span className="whitespace-nowrap">{formatTetri(l.lineTotal)}</span>
            </li>
          ))}
        </ul>
        {quote && !pricePending && <Totals quote={quote} delivery={delivery} />}
        {quote?.deliveryFee === null && !pricePending && delivery === "delivery" && payment !== "cash" && <p className="text-sm leading-relaxed text-ink-2">{cartCopy.onlineProductsOnly}</p>}
        <label className="flex min-h-11 gap-2 text-sm">
          <input type="checkbox" name="terms" defaultChecked={v.terms === "on"} data-testid="terms"
                 disabled={pending || Boolean(state.ok)} required aria-invalid={Boolean(err("terms"))} aria-describedby={err("terms") ? "checkout-terms-error" : undefined}
                 className="mt-1 accent-[var(--accent)]" />
          <span>{t("checkout.terms.agree")}{" "}
            <Link href="/info/terms" target="_blank" className="text-accent underline">{t("checkout.terms.link")}</Link>
            <span className="block text-xs text-ink-2">{t("checkout.terms.privacy")}{" "}
              <Link href="/info/privacy" target="_blank" className="underline">{t("checkout.terms.privacy_link")}</Link></span>
          </span>
        </label>
        <FieldError id="checkout-terms-error" msg={err("terms")} />
        <button type="submit" disabled={blocked} data-testid="place-order"
                className="min-h-11 w-full rounded-card bg-accent px-4 py-3 font-medium text-accent-ink hover:opacity-90 disabled:opacity-50">
          {pending ? cartCopy.pending : state.ok ? cartCopy.redirecting : payment === "cash" ? t("checkout.submit") : t("checkout.submit.pay")}
        </button>
      </aside>
    </form>
  );
}

function FieldError({ id, msg }: { id: string; msg?: MessageKey }) {
  return msg ? <span id={id} className="mt-1 block text-xs text-warn">{t(msg)}</span> : null;
}
