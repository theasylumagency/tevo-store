"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { placeOrderAction, type CheckoutState } from "@/app/actions/checkout";
import type { DeliveryMethod, PaymentMethod } from "@/config/store";
import { t, type MessageKey } from "@/i18n";
import { formatTetri } from "@/lib/money";
import ui from "@/components/storefront/foundation.module.css";
import { useCart } from "./CartProvider";
import { CartThumbnail, QuoteFeedback, Totals, useQuote } from "./CartView";
import { cartCopy } from "./cartCopy";
import { EmptyCart, PurchaseLoading } from "./PurchaseStates";
import styles from "./purchase.module.css";

interface Props {
  paymentMethods: PaymentMethod[];
  deliveryMethods: DeliveryMethod[];
  regions: readonly string[];
  testMode: boolean;
}

export function CheckoutForm({ paymentMethods, deliveryMethods, regions, testMode }: Props) {
  const cart = useCart();
  const [state, action, pending] = useActionState<CheckoutState, FormData>(placeOrderAction, {});
  const { quote, notes, loading, failed, retry, canCheckout, pricePending, stockPending } = useQuote(state.quote);
  const formRef = useRef<HTMLFormElement>(null);
  const v = state.values ?? {};
  const [delivery, setDelivery] = useState<DeliveryMethod>((v.deliveryMethod as DeliveryMethod) || deliveryMethods[0]);
  const [payment, setPayment] = useState<PaymentMethod>((v.paymentMethod as PaymentMethod) || paymentMethods[0]);
  const [addressDraft, setAddressDraft] = useState({ region: v.region ?? "", city: v.city ?? "", address: v.address ?? "" });

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

  if (!cart.ready) return <PurchaseLoading checkout />;
  if (!cart.items.length && !state.ok) {
    return <div className={styles.cartBody}>
      {notes.map((note) => <p key={note} className={ui.notice}>{t(note)}</p>)}
      <EmptyCart />
    </div>;
  }

  const err = (k: string) => state.fieldErrors?.[k];
  const field = styles.field;
  const deliveryPending = delivery === "delivery" && quote?.deliveryFee === null;
  const blocked = pending || Boolean(state.ok) || !canCheckout || !payment || !delivery || deliveryPending;
  const fieldsDisabled = pending || Boolean(state.ok);

  return (
    <form ref={formRef} action={action}
      onSubmit={(event) => { if (blocked) event.preventDefault(); }}
      // A resolved Action also resets native radios after validation errors. Keep the draft and
      // checked controls aligned with React state; successful checkout clears the cart and redirects.
      onReset={(event) => event.preventDefault()}
      className={styles.checkoutGrid} noValidate aria-busy={pending}>
      <input type="hidden" name="prices" value={JSON.stringify(Object.fromEntries((quote?.lines ?? []).map(l => [l.productId, l.unitPrice])))} />
      <input type="hidden" name="items" value={JSON.stringify(cart.items.map((i) => ({ productId: i.productId, qty: i.qty })))} />
      <div className={styles.formSections}>
        {state.formError && <p id="checkout-error" role="alert" tabIndex={-1} className={`${ui.notice} ${styles.warning}`}>{t(state.formError)}</p>}
        {state.fieldErrors && <p role="alert" className={`${ui.notice} ${styles.warning}`}>გთხოვთ, შეამოწმოთ მონიშნული ველები. შეყვანილი ინფორმაცია შენარჩუნებულია.</p>}
        {notes.map((n) => <p key={n} className={ui.notice}>{t(n)}</p>)}
        {(!delivery || !payment) && <p className={ui.notice}>შეკვეთის გაფორმება დროებით მიუწვდომელია. <Link href="/info/contact" className="underline underline-offset-4">დაგვიკავშირდით</Link>.</p>}

        <fieldset className={styles.formSection} disabled={fieldsDisabled}>
          <legend className={styles.sectionLegend}>{t("checkout.contact")}</legend>
          <div className={styles.contactFields}>
            <label className={`${styles.label} ${styles.fullWidth}`}><span className={styles.labelText}>{t("checkout.name")}</span>
              <input name="name" defaultValue={v.name} maxLength={120} autoComplete="name" required aria-invalid={Boolean(err("name"))} aria-describedby={err("name") ? "checkout-name-error" : undefined} className={field} /><FieldError id="checkout-name-error" msg={err("name")} /></label>
            <label className={styles.label}><span className={styles.labelText}>{t("checkout.phone")}</span>
              <input name="phone" defaultValue={v.phone} type="tel" inputMode="tel" autoComplete="tel" placeholder="5XX XX XX XX" required aria-invalid={Boolean(err("phone"))} aria-describedby={`checkout-phone-hint${err("phone") ? " checkout-phone-error" : ""}`} className={field} />
              <span id="checkout-phone-hint" className={styles.fieldHint}>{t("checkout.phone.hint")}</span><FieldError id="checkout-phone-error" msg={err("phone")} /></label>
            <label className={styles.label}><span className={styles.labelText}>{t("checkout.email")}</span>
              <input name="email" defaultValue={v.email} type="email" maxLength={200} autoComplete="email" aria-invalid={Boolean(err("email"))} aria-describedby={err("email") ? "checkout-email-error" : undefined} className={field} /><FieldError id="checkout-email-error" msg={err("email")} /></label>
          </div>
        </fieldset>

        <fieldset className={styles.formSection} disabled={fieldsDisabled}>
          <legend className={styles.sectionLegend}>{t("checkout.delivery")}</legend>
          <div className={styles.sectionContent}>
            <div className={styles.choices}>
              {deliveryMethods.map((method) => (
                <label key={method} className={`${styles.choice} ${delivery === method ? styles.choiceSelected : ""}`}>
                  <input type="radio" name="deliveryMethod" value={method} checked={delivery === method} onChange={() => setDelivery(method)}
                    aria-invalid={Boolean(err("deliveryMethod"))} aria-describedby={err("deliveryMethod") ? "checkout-delivery-error" : undefined} />
                  <span><span className={styles.choiceTitle}>{t(`checkout.delivery.${method}` as MessageKey)}</span>
                    <span className={styles.choiceHint}>{t(`checkout.delivery.${method}.hint` as MessageKey)}</span></span>
                </label>
              ))}
              <FieldError id="checkout-delivery-error" msg={err("deliveryMethod")} />
            </div>
            {/* Keep the user's address mounted; disable it while hidden so pickup never submits an address. */}
            <fieldset className={styles.addressFields} hidden={delivery !== "delivery"} disabled={delivery !== "delivery" || fieldsDisabled}>
              <legend className="sr-only">მიწოდების მისამართი</legend>
              <label className={styles.label}><span className={styles.labelText}>{t("checkout.region")}</span>
                <select name="region" value={addressDraft.region} onChange={(event) => setAddressDraft({ ...addressDraft, region: event.target.value })} autoComplete="address-level1" required aria-invalid={Boolean(err("region"))} aria-describedby={err("region") ? "checkout-region-error" : undefined} className={field}>
                  <option value="">აირჩიეთ რეგიონი</option>
                  {regions.map((region) => <option key={region} value={region}>{region}</option>)}
                </select><FieldError id="checkout-region-error" msg={err("region")} /></label>
              <label className={styles.label}><span className={styles.labelText}>{t("checkout.city")}</span>
                <input name="city" value={addressDraft.city} onChange={(event) => setAddressDraft({ ...addressDraft, city: event.target.value })} maxLength={120} autoComplete="address-level2" required aria-invalid={Boolean(err("city"))} aria-describedby={err("city") ? "checkout-city-error" : undefined} className={field} /><FieldError id="checkout-city-error" msg={err("city")} /></label>
              <label className={`${styles.label} ${styles.fullWidth}`}><span className={styles.labelText}>{t("checkout.address")}</span>
                <input name="address" value={addressDraft.address} onChange={(event) => setAddressDraft({ ...addressDraft, address: event.target.value })} maxLength={300} autoComplete="street-address" required aria-invalid={Boolean(err("address"))} aria-describedby={err("address") ? "checkout-address-error" : undefined} className={field} /><FieldError id="checkout-address-error" msg={err("address")} /></label>
            </fieldset>
            <label className={styles.label}><span className={styles.labelText}>{t("checkout.comment")}</span>
              <textarea name="comment" defaultValue={v.comment} maxLength={1000} rows={3} className={field} /></label>
          </div>
        </fieldset>

        <fieldset className={styles.formSection} disabled={fieldsDisabled}>
          <legend className={styles.sectionLegend}>{t("checkout.payment")}</legend>
          <div className={styles.choices}>
            {paymentMethods.map((method) => (
              <label key={method} className={`${styles.choice} ${payment === method ? styles.choiceSelected : ""}`}>
                <input type="radio" name="paymentMethod" value={method} checked={payment === method} onChange={() => setPayment(method)}
                  aria-invalid={Boolean(err("paymentMethod"))} aria-describedby={err("paymentMethod") ? "checkout-payment-error" : undefined} />
                <span><span className={styles.choiceTitle}>{t(`checkout.payment.${method}` as MessageKey)}</span>
                  <span className={styles.choiceHint}>{t(`checkout.payment.${method}.hint` as MessageKey)}</span></span>
              </label>
            ))}
            <FieldError id="checkout-payment-error" msg={err("paymentMethod")} />
            {testMode && payment !== "cash" && <p className={ui.notice}>{t("checkout.test_mode")}</p>}
          </div>
        </fieldset>
      </div>

      <aside className={styles.summary} aria-labelledby="checkout-summary-heading">
        <div className={styles.summaryHeading}>
          <h2 id="checkout-summary-heading" className={styles.summaryTitle}>თქვენი შეკვეთა</h2>
          <span className={styles.summaryCount}>{cart.count} ერთეული</span>
        </div>
        <QuoteFeedback loading={loading} failed={failed} retry={retry} />
        <ul className={styles.summaryItems}>
          {(quote?.lines ?? []).map((l) => (
            <li key={l.productId} className={styles.summaryItem}>
              <CartThumbnail image={l.image} sizes="48px" />
              <div className={styles.summaryItemName}>
                <span>{l.name}</span>
                <div className={styles.summaryItemMeta}><span>{l.qty} ერთეული</span><strong>{formatTetri(l.lineTotal)}</strong></div>
              </div>
            </li>
          ))}
        </ul>
        <Link href="/cart" className={ui.quietAction}>{cartCopy.reviewCart}</Link>
        {quote && !pricePending && <Totals quote={quote} delivery={delivery} />}
        {pricePending && <p className={`${ui.notice} ${styles.warning}`}>პროდუქტის ფასი დასაზუსტებელია. შეკვეთის გასაგრძელებლად გადახედეთ კალათას.</p>}
        {stockPending && <p className={`${ui.notice} ${styles.warning}`}>მარაგის დაზუსტებამდე შეკვეთა ვერ გაფორმდება. <Link href="/info/contact" className="underline underline-offset-4">დაგვიკავშირდით</Link>.</p>}
        {deliveryPending && <p className={`${ui.notice} ${styles.warning}`} data-testid="delivery-confirmation-required">{cartCopy.deliveryConfirmation} <Link href="/info/contact" className="underline underline-offset-4">სრული პირობების დაზუსტება</Link>.</p>}
        <label className={styles.terms}>
          <input type="checkbox" name="terms" defaultChecked={v.terms === "on"} data-testid="terms"
                 disabled={fieldsDisabled} required aria-invalid={Boolean(err("terms"))} aria-describedby={err("terms") ? "checkout-terms-error" : undefined} />
          <span className={styles.termsCopy}>{t("checkout.terms.agree")}{" "}
            <Link href="/info/terms" target="_blank">{t("checkout.terms.link")}<span className="sr-only"> — ახალ ჩანართში</span></Link>
            <span className={styles.privacy}>{t("checkout.terms.privacy")}{" "}
              <Link href="/info/privacy" target="_blank">{t("checkout.terms.privacy_link")}<span className="sr-only"> — ახალ ჩანართში</span></Link></span>
          </span>
        </label>
        <FieldError id="checkout-terms-error" msg={err("terms")} />
        <button type="submit" disabled={blocked} data-testid="place-order"
                className={`${ui.primaryAction} ${styles.summaryAction}`}>
          {pending ? cartCopy.pending : state.ok ? cartCopy.redirecting : payment === "cash" ? t("checkout.submit") : t("checkout.submit.pay")}
        </button>
        {(pending || state.ok) && <p role="status" className={styles.submitNotice}>{state.ok ? cartCopy.redirecting : cartCopy.pending}</p>}
      </aside>
    </form>
  );
}

function FieldError({ id, msg }: { id: string; msg?: MessageKey }) {
  return msg ? <span id={id} className={styles.fieldError}>{t(msg)}</span> : null;
}
