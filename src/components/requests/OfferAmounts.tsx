"use client";

import { useState } from "react";
import { formatTetri } from "@/lib/money";
import { parseOfferMoney } from "@/lib/requests/offer-model";

const field = "w-full rounded-card border border-line px-3 py-2";
type Line = { productId: string; name: string; qty: number; initialPrice: string };
export function OfferAmounts({ lines, initialFee }: { lines: Line[]; initialFee: string }) {
  const [prices, setPrices] = useState<Record<string, string>>(() => Object.fromEntries(lines.map(l => [l.productId, l.initialPrice])));
  const [fee, setFee] = useState(initialFee);
  const amounts = lines.map(line => {
    const price = parseOfferMoney(prices[line.productId] ?? "");
    return price === null ? null : price * line.qty;
  });
  const subtotal = amounts.every(v => v !== null) ? amounts.reduce<number>((sum, n) => sum + (n ?? 0), 0) : null;
  const deliveryFee = parseOfferMoney(fee, true);
  const total = subtotal !== null && deliveryFee !== null && subtotal + deliveryFee <= 2147483647 ? subtotal + deliveryFee : null;
  return <div className="space-y-3">
    <div className="divide-y divide-line">{lines.map(line => <label key={line.productId} className="grid gap-2 py-2 sm:grid-cols-[1fr_10rem] sm:items-center">
      <span>{line.name} · {line.qty} ც. — ერთეულის ფასი ₾</span>
      <input className={field} name={"price:" + line.productId} inputMode="decimal" required value={prices[line.productId] ?? ""}
        onChange={e => setPrices(previous => ({ ...previous, [line.productId]: e.target.value }))} />
    </label>)}</div>
    <label className="block space-y-1"><span>მიწოდების სრული საფასური ₾ (თვითგატანისას 0)</span>
      <input className={field} name="deliveryFee" inputMode="decimal" required value={fee} onChange={e => setFee(e.target.value)} />
    </label>
    <div className="space-y-1 rounded-card border border-line p-3" aria-live="polite">
      <p className="text-sm text-ink-2">პროდუქტები: {formatTetri(subtotal) ?? "დასაზუსტებელია"}</p>
      <p className="font-semibold">სრული ღირებულება: <span data-testid="offer-preview-total">{formatTetri(total) ?? "დასაზუსტებელია"}</span></p>
    </div>
  </div>;
}
