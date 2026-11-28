import Link from "next/link";
import { decideOfferAction } from "@/app/actions/requests";
import { activeOffer, type PublicOffer } from "@/lib/requests/offer-model";
import { OfferDetails } from "./OfferDetails";
import ui from "@/components/storefront/foundation.module.css";

const resultText: Record<string, string> = {
  invalid: "შეამოწმეთ მონიშნული პირობები და შევსებული ველები.",
  conflict: "შეთავაზება შეიცვალა ან აღარ არის მოქმედი. გადახედეთ მიმდინარე ვერსიას.",
  expired: "შეთავაზების ვადა გასულია. შეკვეთა არ შექმნილა; მოითხოვეთ ახალი პირობები მაღაზიასთან.",
  unavailable: "მიწოდების ან მარაგის პირობები შეიცვალა. შეკვეთა არ შექმნილა; საჭიროა ახალი შეთავაზება.",
  terms_changed: "შეძენის წესები შეიცვალა. საჭიროა ახალი შეთავაზება.",
  rejected: "შეთავაზება უარყოფილია. შეკვეთა არ შექმნილა.",
  clarification: "დამატებითი დაზუსტება გაიგზავნა. შეკვეთა არ შექმნილა.",
};
export function CustomerOffer({ id, token, offers, convertedOrderUrl, result, closed }: {
  id: string; token: string; offers: PublicOffer[]; convertedOrderUrl: string | null;
  result?: string; closed: boolean;
}) {
  const current = offers.at(-1);
  if (!current) return null;
  const canDecide = !closed && activeOffer(current) && !convertedOrderUrl;
  function hidden() {
    return <><input type="hidden" name="id" value={id} /><input type="hidden" name="token" value={token} />
      <input type="hidden" name="version" value={current!.version} /></>;
  }
  return <section className="space-y-4 rounded-card border border-line bg-surface p-4" data-testid="customer-offer">
    <h2 className={ui.sectionTitle}>სრული შეთავაზება</h2>
    {result && resultText[result] && <p className={ui.notice} role="status">{resultText[result]}</p>}
    <OfferDetails offer={current} />
    {convertedOrderUrl ? <p><Link href={convertedOrderUrl} className={ui.primaryAction}>შეკვეთის ნახვა</Link></p> : canDecide ? <>
      <p className="text-sm text-ink-2">მიღებისას შეიქმნება შეკვეთა ზემოთ მითითებული პირობებით. შეგიძლიათ უარყოთ ან მოითხოვოთ დაზუსტება. ფიზიკური მარაგის ჯავშანი არ ხდება.</p>
      <form action={decideOfferAction} className="space-y-3">
        {hidden()}<input type="hidden" name="decision" value="accept" /><input type="hidden" name="termsVersion" value={current.termsVersion} />
        <label className="flex items-start gap-2">
          <input type="checkbox" name="terms" required className="mt-1" />
          <span>ვეთანხმები შეთავაზების სრულ ღირებულებას, მიღების პირობებსა და <Link href="/info/terms" target="_blank" className="underline">წესებს და პირობებს</Link>. თანხას გადავიხდი მიღებისას.</span>
        </label>
        <button type="submit" className={ui.primaryAction} data-testid="accept-offer">მიღება და შეკვეთის გაფორმება</button>
      </form>
      <form action={decideOfferAction} className="space-y-2 border-t border-line pt-3">
        {hidden()}<input type="hidden" name="decision" value="clarify" />
        <label className="block space-y-1"><span>რა არის დასაზუსტებელი?</span>
          <textarea name="clarification" required maxLength={1000} rows={3} className="w-full rounded-card border border-line bg-surface px-3 py-2" />
        </label>
        <button type="submit" className={ui.secondaryAction} data-testid="clarify-offer">დამატებითი დაზუსტება</button>
      </form>
      <form action={decideOfferAction}>{hidden()}<input type="hidden" name="decision" value="reject" />
        <button type="submit" className={ui.quietAction} data-testid="reject-offer">შეთავაზებაზე უარის თქმა</button>
      </form>
    </> : !closed && <p className="text-sm text-ink-2">ახალი შეთავაზებისთვის დაუკავშირდით მაღაზიას და მიუთითეთ მოთხოვნის ნომერი.</p>}
    {offers.length > 1 && <details><summary className="cursor-pointer">წინა ვერსიები ({offers.length - 1})</summary>
      <div className="mt-3 space-y-4">{offers.slice(0, -1).reverse().map(offer => <div className="border-t border-line pt-3" key={offer.version}><OfferDetails offer={offer} /></div>)}</div>
    </details>}
  </section>;
}
