import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth/admin";
import { listPurchaseRequests } from "@/lib/requests/service";
import { REQUEST_STATUSES, REQUEST_LABELS, type RequestStatus } from "@/lib/requests/model";
import { formatPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "მოთხოვნები", robots: { index: false, follow: false } };
const dt = new Intl.DateTimeFormat("ka-GE", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Tbilisi" });

async function Requests({ searchParams }: PageProps<"/admin/requests">) {
  await connection();
  if (!(await isAdmin())) redirect("/admin/login?next=/admin/requests");
  const sp = await searchParams;
  const status = REQUEST_STATUSES.find(s => s === sp.status);
  const rows = await listPurchaseRequests(status);
  function tab(s: RequestStatus | undefined, label: string) {
    return <Link key={s ?? "all"} href={s ? "/admin/requests?status=" + s : "/admin/requests"}
      aria-current={s === status ? "page" : undefined}
      className={`whitespace-nowrap rounded-full border px-3 py-1 text-sm ${s === status ? "border-accent bg-accent-soft" : "border-line bg-surface"}`}>{label}</Link>;
  }
  return <div className="space-y-4">
    <h1 className="text-2xl font-bold">მოთხოვნები</h1>
    <p className="text-sm text-ink-2">ფასის, მარაგისა და მიწოდების პირობების დაზუსტება. ეს ჩანაწერები შეკვეთებად და გაყიდვებად არ ითვლება.</p>
    <div className="flex gap-2 overflow-x-auto pb-1">{tab(undefined, "ყველა")}{REQUEST_STATUSES.map(s => tab(s, REQUEST_LABELS[s]))}</div>
    {!rows.length ? <p className="text-ink-2">მოთხოვნები არ არის.</p> : <div className="overflow-x-auto rounded-card border border-line bg-surface">
      <table className="w-full text-sm" data-testid="purchase-requests-table">
        <thead className="border-b border-line text-left text-xs text-ink-2"><tr>
          {["ნომერი", "თარიღი", "მომხმარებელი", "პროდუქტები", "სტატუსი"].map(c => <th key={c} className="px-3 py-2 font-medium">{c}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-line">{rows.map(r => <tr key={r.id}>
          <td className="px-3 py-2"><Link href={"/admin/requests/" + r.id} className="text-accent underline font-mono">{r.id.slice(0, 8)}</Link></td>
          <td className="whitespace-nowrap px-3 py-2">{dt.format(r.createdAt)}</td>
          <td className="px-3 py-2">{r.name}<span className="block text-xs text-ink-2">{formatPhone(r.phone)}</span></td>
          <td className="px-3 py-2">{r.lines.length} დასახელება</td>
          <td className="whitespace-nowrap px-3 py-2">{REQUEST_LABELS[r.status]}</td>
        </tr>)}</tbody>
      </table>
    </div>}
    {rows.length === 100 && <p className="text-sm text-ink-2">ნაჩვენებია ბოლო 100 მოთხოვნა. გამოიყენეთ სტატუსის ფილტრი.</p>}
  </div>;
}
export default function AdminRequests(props: PageProps<"/admin/requests">) {
  return <Suspense fallback={<p role="status">იტვირთება…</p>}><Requests {...props} /></Suspense>;
}
