import { issueOfferAction, withdrawOfferAction } from "@/app/actions/requests";
import { GEORGIA_REGIONS, getStore } from "@/config/store";
import type { PurchaseRequest } from "@/db/schema";
import { OfferDetails } from "./OfferDetails";
import { OfferAmounts } from "./OfferAmounts";
import { DELIVERY_LABELS } from "@/lib/requests/model";

const field = "w-full rounded-card border border-line px-3 py-2";
const panel = "space-y-3 rounded-card border border-line bg-surface p-4";
const resultText: Record<string, string> = {
  saved: "შეთავაზება გამოქვეყნებულია.",
  invalid: "შეავსეთ ყველა აუცილებელი პირობა, ზუსტი თანხა და მარაგის დადასტურება.",
  conflict: "ჩანაწერი უკვე შეიცვალა. შეამოწმეთ ახალი ვერსია.",
  unavailable: "პროდუქტი აღარ არის ხელმისაწვდომი ან არჩევანი აღარ ემთხვევა მოქმედ კატალოგს.",
  withdrawn: "შეთავაზება გაუქმებულია.",
};
const money = (tetri: number | null | undefined) => tetri == null ? "" : (tetri / 100).toFixed(2);
export function AdminOffer({ request, result }: { request: PurchaseRequest; result?: string }) {
  const store = getStore();
  const latest = request.offers.at(-1);
  const editable = request.status !== "closed" && !request.convertedOrderId && store.paymentMethods.includes("cash") && store.deliveryMethods.length > 0 && request.offers.length < 30;
  const preferred = latest?.deliveryMethod ?? (request.deliveryMethod === "undecided" ? store.deliveryMethods[0] : request.deliveryMethod);
  return <section className={panel} data-testid="admin-offer">
    <h2 className="text-lg font-semibold">სრული შეთავაზება</h2>
    {result && resultText[result] && <p role="status" className="rounded-card bg-line/30 p-3">{resultText[result]}</p>}
    {latest && <>
      <OfferDetails offer={latest} />
      <p className="text-sm text-ink-2 break-words">მარაგის დადასტურების საფუძველი (შიდა): {latest.stockEvidence}</p>
      {request.convertedOrderId && <p className="font-medium">შეთავაზება გარდაიქმნა შეკვეთად.</p>}
      {latest.state === "issued" && request.status !== "closed" && <form action={withdrawOfferAction}>
        <input type="hidden" name="id" value={request.id} /><input type="hidden" name="revision" value={request.revision} />
        <button type="submit" className="rounded-card border border-line px-3 py-2" data-testid="withdraw-offer">შეთავაზების გაუქმება</button>
      </form>}
    </>}
    {editable ? <form key={request.revision} action={issueOfferAction} className="space-y-3 border-t border-line pt-3">
      <input type="hidden" name="id" value={request.id} /><input type="hidden" name="revision" value={request.revision} />
      <h3 className="font-semibold">{latest ? "ახალი ვერსიის გამოქვეყნება" : "შეთავაზების მომზადება"}</h3>
      <p className="text-sm text-ink-2">გამოქვეყნებამდე გადაამოწმეთ ზუსტი რაოდენობა და ყველა პირობა. შეცვლა ძველ ვერსიას გააუქმებს. ეს ფასები მხოლოდ ამ მოთხოვნას ეხება და კატალოგს არ ცვლის.</p>
      <OfferAmounts lines={request.lines.map(line => ({ productId: line.productId, name: line.name, qty: line.qty,
        initialPrice: money(latest?.lines.find(p => p.productId === line.productId)?.unitPrice ?? line.unitPrice) }))}
        initialFee={money(latest?.deliveryFee)} />
      <label className="block space-y-1"><span>მიღების წესი</span>
        <select className={field} name="deliveryMethod" defaultValue={preferred}>
          {store.deliveryMethods.map(m => <option key={m} value={m}>{DELIVERY_LABELS[m]}</option>)}
        </select>
      </label>
      <label className="block space-y-1"><span>რეგიონი (მიწოდებისთვის აუცილებელია)</span>
        <select className={field} name="region" defaultValue={latest?.region ?? ""}><option value="">აირჩიეთ</option>{GEORGIA_REGIONS.map(r => <option key={r}>{r}</option>)}</select>
      </label>
      <label className="block space-y-1"><span>ქალაქი ან სოფელი (მიწოდებისთვის აუცილებელია)</span>
        <input className={field} name="city" maxLength={120} defaultValue={latest?.city ?? request.locality ?? ""} />
      </label>
      <label className="block space-y-1"><span>ზუსტი მისამართი (მიწოდების ან თვითგატანის)</span>
        <input className={field} name="address" minLength={3} maxLength={300} required defaultValue={latest?.address ?? ""} />
      </label>
      <label className="block space-y-1"><span>მიღების დრო და პირობები</span>
        <textarea className={field} name="fulfilment" minLength={3} maxLength={300} required rows={3} defaultValue={latest?.fulfilment ?? ""} />
      </label>
      <label className="block space-y-1"><span>შეთავაზების მოქმედების ვადა</span>
        <select className={field} name="expiresHours" defaultValue="24">{[1, 6, 12, 24, 48, 72].map(h => <option key={h} value={h}>{h} საათი</option>)}</select>
      </label>
      <label className="block space-y-1"><span>მარაგის დადასტურების საფუძველი — შიდა ჩანაწერი</span>
        <textarea className={field} name="stockEvidence" minLength={5} maxLength={500} required rows={3} />
      </label>
      <label className="flex items-start gap-2"><input type="checkbox" name="confirmed" required className="mt-1" /><span>გადამოწმებულია ყველა პროდუქტის ზუსტი რაოდენობა, სრული ფასი, მიღების მისამართი და ვადა. გადახდა მოხდება მიღებისას.</span></label>
      <button type="submit" className="rounded-card bg-accent px-4 py-2 font-semibold text-white" data-testid="issue-offer">შეთავაზების გამოქვეყნება</button>
    </form> : <p className="text-sm text-ink-2">ახალი ვერსიის გამოქვეყნება ამ ეტაპზე მიუწვდომელია.</p>}
    {request.offers.length > 1 && <details><summary className="cursor-pointer">წინა ვერსიები ({request.offers.length - 1})</summary>
      <div className="mt-3 space-y-4">{request.offers.slice(0, -1).reverse().map(o => <div className="border-t border-line pt-3" key={o.version}><OfferDetails offer={o} /><p className="text-sm text-ink-2">შიდა საფუძველი: {o.stockEvidence}</p></div>)}</div>
    </details>}
  </section>;
}
