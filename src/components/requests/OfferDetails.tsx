import { formatTetri } from "@/lib/money";
import { OFFER_LABELS, offerState, type PublicOffer } from "@/lib/requests/offer-model";
import { DELIVERY_LABELS } from "@/lib/requests/model";

const dt = new Intl.DateTimeFormat("ka-GE", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Tbilisi" });
export function OfferDetails({ offer }: { offer: PublicOffer }) {
  return <div className="space-y-3">
    <p className="font-semibold">შეთავაზება №{offer.version} · {OFFER_LABELS[offerState(offer)]}</p>
    <p className="text-sm text-ink-2">მოქმედების ვადა: {dt.format(new Date(offer.expiresAt))}</p>
    <ul className="divide-y divide-line">{offer.lines.map(line => <li key={line.productId} className="grid gap-1 py-2 sm:grid-cols-[1fr_auto]">
      <span>{line.name} · {line.qty} ც. × {formatTetri(line.unitPrice)}</span>
      <span className="font-medium">{formatTetri(line.lineTotal)}</span>
    </li>)}</ul>
    <dl className="space-y-2 border-t border-line pt-3">
      <div className="flex justify-between gap-4"><dt>პროდუქტები</dt><dd>{formatTetri(offer.subtotal)}</dd></div>
      <div className="flex justify-between gap-4"><dt>{DELIVERY_LABELS[offer.deliveryMethod]}</dt><dd>{formatTetri(offer.deliveryFee)}</dd></div>
      <div className="flex justify-between gap-4 text-lg font-bold"><dt>სრული ღირებულება</dt><dd>{formatTetri(offer.total)}</dd></div>
    </dl>
    <p>მისამართი: {[offer.region, offer.city, offer.address].filter(Boolean).join(", ")}</p>
    <p className="whitespace-pre-wrap break-words">მიღების დრო და პირობები: {offer.fulfilment}</p>
    <p>გადახდა მიღებისას — ონლაინ თანხა არ ჩამოიჭრება.</p>
    {offer.clarification && <p className="whitespace-pre-wrap break-words">დამატებითი შეკითხვა: {offer.clarification}</p>}
  </div>;
}
