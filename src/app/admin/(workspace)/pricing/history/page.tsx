import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { catalogRole } from "@/lib/auth/admin";
import { publishedPriceHistory } from "@/lib/catalog/editorial";
import { dateText } from "../../catalog/format";
import { button, field } from "../../catalog/styles";
import { Price } from "../Price";

export const metadata = { title: "ფასების ისტორია" };
const reasons = { global: "საერთო წესი", product: "პროდუქტის გამოქვეყნება", import: "წყაროს განახლება" };

async function History({ searchParams }: PageProps<"/admin/pricing/history">) {
  const role = await catalogRole();
  if (!role) redirect("/admin/login?next=/admin/pricing/history");
  if (role !== "admin") redirect("/admin/catalog");
  const sp = await searchParams;
  const id = typeof sp.sku === "string" ? sp.sku.trim().toLowerCase().slice(0, 100) : "";
  const cursor = Number(sp.before);
  const history = await publishedPriceHistory(id, Number.isSafeInteger(cursor) && cursor > 0 && cursor <= 2147483647 ? cursor : undefined);
  return <div className="mx-auto max-w-5xl space-y-4">
    <Link className="text-sm text-accent underline" href="/admin/pricing">ფასებზე დაბრუნება</Link>
    <h1 className="text-2xl font-bold">ფასების ისტორია</h1>
    <form className="flex items-end gap-2"><label className="text-sm">პროდუქტის კოდი (SKU)
      <input name="sku" defaultValue={id} placeholder="at-8425" className={field}/></label><button className={button}>ძებნა</button></form>
    {history.length ? <div className="overflow-x-auto rounded-card border border-line bg-surface"><table className="w-full text-left text-sm">
      <thead className="border-b border-line"><tr>{["პროდუქტი", "ცვლილება", "ძველი ფასი", "ახალი ფასი"].map(h =>
        <th key={h} className="p-3">{h}</th>)}</tr></thead>
      <tbody className="divide-y divide-line">{history.slice(0, 30).map(h => <tr key={h.id}>
        <td className="p-3">{h.name}<span className="block text-xs text-ink-2">{h.productId}</span></td>
        <td className="p-3">{reasons[h.reason]}<span className="block text-xs text-ink-2">{dateText(h.createdAt)}</span></td>
        <td className="p-3"><Price value={h.before}/></td><td className="p-3"><Price value={h.after}/></td>
      </tr>)}</tbody></table></div> : <p>ფასის ცვლილება ჯერ არ დაფიქსირებულა.</p>}
    {history.length > 30 && <Link className={button} href={"/admin/pricing/history?" + new URLSearchParams({
      sku: id, before: String(history[29].id),
    })}>ადრინდელი ცვლილებები</Link>}
  </div>;
}

export default function Page(props: PageProps<"/admin/pricing/history">) {
  return <Suspense><History {...props}/></Suspense>;
}
