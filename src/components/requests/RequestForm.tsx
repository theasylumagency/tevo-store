"use client";

import Link from "next/link";
import { useDecisionSignals } from "@/components/analytics/DecisionSignals";
import { reportDecisionEvent } from "@/lib/analytics/client";
import { useActionState, useState } from "react";
import { submitPurchaseRequest, type RequestFormState } from "@/app/actions/requests";
import { useCart } from "@/components/cart/CartProvider";
import { DELIVERY_LABELS, type RequestDelivery } from "@/lib/requests/model";
import type { DeliveryMethod } from "@/config/store";
import ui from "@/components/storefront/foundation.module.css";

type ProductSelection = { productId: string; name: string; slug: string };
const field = "w-full rounded-card border border-line bg-surface px-3 py-2";

export function RequestForm({ product, token, methods, maxQuantity, initialDelivery }: {
  product: ProductSelection | null;
  token: string;
  methods: DeliveryMethod[];
  maxQuantity: number;
  initialDelivery: RequestDelivery;
}) {
  const cart = useCart();
  const [accessToken] = useState(token);
  const [quantity, setQuantity] = useState("1");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [delivery, setDelivery] = useState<RequestDelivery>(initialDelivery);
  const [locality, setLocality] = useState("");
  const [question, setQuestion] = useState("");
  const [state, action, pending] = useActionState<RequestFormState, FormData>(submitPurchaseRequest, {});
  const selected = product ? [{ ...product, qty: Number(quantity) }] : cart.items;
  const invalidSelection = !selected.length || selected.length > 30 ||
    selected.some(p => !Number.isInteger(p.qty) || p.qty < 1 || p.qty > maxQuantity);
  useDecisionSignals((product || cart.ready) && selected.length > 0 ? [
    "request_form_view", ...(state.error ? ["request_error" as const] : []),
  ] : []);
  if (!product && !cart.ready) return <p role="status">არჩევანი იტვირთება…</p>;
  if (!selected.length) return <section className={ui.state}>
    <h2 className={ui.stateTitle}>ჯერ პროდუქტი არ გაქვთ შერჩეული</h2>
    <p className={ui.stateCopy}>დაამატეთ პროდუქტები კალათაში ან მოითხოვეთ ინფორმაცია კონკრეტული პროდუქტის გვერდიდან.</p>
    <Link className={ui.primaryAction} href="/search">კატალოგი</Link>
  </section>;

  return <form action={action} className="grid gap-6 lg:grid-cols-2" aria-busy={pending}
    onSubmit={event => { if (pending || invalidSelection) event.preventDefault(); else void reportDecisionEvent("request_submit"); }}>
    <input type="hidden" name="token" value={accessToken} />
    <input type="hidden" name="items" value={JSON.stringify(selected.map(p => ({ productId: p.productId, qty: p.qty })))} />
    <section className="space-y-3 rounded-card border border-line bg-surface p-4">
      <h2 className={ui.sectionTitle}>რა გაინტერესებთ</h2>
      <ul className="divide-y divide-line">
        {selected.map(p => <li className="flex flex-wrap items-center justify-between gap-3 py-3" key={p.productId}>
          <Link className="underline underline-offset-4" href={"/p/" + p.slug}>{p.name}</Link>
          {product ? <label className="flex items-center gap-2">რაოდენობა
            <input type="number" className="w-20 rounded-card border border-line px-2 py-1" min={1} max={maxQuantity} step={1}
              value={quantity} onChange={e => setQuantity(e.target.value)} required disabled={pending} />
          </label> : <span>{p.qty} ც.</span>}
        </li>)}
      </ul>
      {!product && <Link href="/cart" className={ui.quietAction}>კალათის გადახედვა</Link>}
      {invalidSelection && <p role="alert" className={ui.notice}>ერთ მოთხოვნაში მაქსიმუმ 30 დასახელება და თითოეულზე {maxQuantity} ერთეულია დასაშვები. შეასწორეთ არჩევანი.</p>}
      <p className="text-sm text-ink-2">ეს მხოლოდ ინფორმაციისა და სრული პირობების მოთხოვნაა. ფასი და მარაგი არ ჯავშნდება, შეკვეთა არ იქმნება და თანხა არ იხდება.</p>
    </section>
    <section className="space-y-4 rounded-card border border-line bg-surface p-4">
      <h2 className={ui.sectionTitle}>საკონტაქტო ინფორმაცია</h2>
      {state.error && <p className={ui.notice} role="alert">{state.error}</p>}
      <fieldset disabled={pending} className="space-y-3">
        <label className="block space-y-1"><span>სახელი და გვარი</span>
          <input className={field} name="name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={120} required />
        </label>
        <label className="block space-y-1"><span>ტელეფონი</span>
          <input className={field} name="phone" type="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} maxLength={40} required />
        </label>
        <label className="block space-y-1"><span>მიღების სასურველი წესი</span>
          <select className={field} name="deliveryMethod" value={delivery} onChange={e => setDelivery(e.target.value as RequestDelivery)}>
            <option value="undecided">{DELIVERY_LABELS.undecided}</option>
            {methods.map(m => <option key={m} value={m}>{DELIVERY_LABELS[m]}</option>)}
          </select>
        </label>
        {delivery !== "pickup" && <label className="block space-y-1"><span>ქალაქი ან სოფელი (არასავალდებულო)</span>
          <input className={field} name="locality" value={locality} onChange={e => setLocality(e.target.value)} maxLength={160} autoComplete="address-level2" />
        </label>}
        <label className="block space-y-1"><span>რა უნდა დავაზუსტოთ? (არასავალდებულო)</span>
          <textarea className={field} name="question" value={question} onChange={e => setQuestion(e.target.value)} maxLength={1000} rows={4} />
        </label>
        <p className="text-sm text-ink-2">მონაცემებს ვიყენებთ მოთხოვნის დამუშავებისთვის. <Link className="underline" href="/info/privacy" target="_blank">კონფიდენციალურობის პირობები</Link>.</p>
        <button type="submit" className={ui.primaryAction} disabled={pending || invalidSelection} data-testid="submit-purchase-request">
          {pending ? "მოთხოვნა იგზავნება…" : "მოთხოვნის გაგზავნა"}
        </button>
      </fieldset>
      <p className="text-sm text-ink-2">გაგზავნის შემდეგ მიიღებთ პირად ბმულს, რომლითაც პასუხს გადაამოწმებთ. კალათა უცვლელად დარჩება.</p>
    </section>
  </form>;
}
