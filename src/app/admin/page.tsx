import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth/admin";
import { listOrders } from "@/lib/orders/service";
import { ORDER_STATUSES } from "@/lib/orders/status";
import { AdminNav } from "@/components/admin/AdminNav";
import { PayBadge, StatusBadge } from "@/components/OrderSummary";
import { formatTetri } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { t, type MessageKey } from "@/i18n";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

const dt = new Intl.DateTimeFormat("ka-GE", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Tbilisi" });

async function Orders({ searchParams }: PageProps<"/admin">) {
  await connection();
  if (!(await isAdmin())) redirect("/admin/login");
  const sp = await searchParams;
  const status = typeof sp.status === "string" && (ORDER_STATUSES as readonly string[]).includes(sp.status) ? sp.status : undefined;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : undefined;
  const { rows, counts } = await listOrders({ status, q });
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const tab = (s: string | undefined, label: string, n: number) => (
    <Link key={s ?? "all"} href={s ? `/admin?status=${s}` : "/admin"}
          className={`whitespace-nowrap rounded-full border px-3 py-1 text-sm ${status === s ? "border-accent bg-accent-soft" : "border-line bg-surface"}`}>
      {label} <span className="text-ink-2">{n}</span>
    </Link>
  );
  return (
    <div className="space-y-4">
      <AdminNav current="orders" />
      <h1 className="text-2xl font-bold">{t("admin.title")}</h1>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tab(undefined, t("admin.all"), total)}
        {ORDER_STATUSES.map((s) => tab(s, t(`status.${s}` as MessageKey), counts[s] ?? 0))}
      </div>
      <form className="flex max-w-md gap-2">
        {status && <input type="hidden" name="status" value={status} />}
        <input name="q" defaultValue={q} placeholder={t("admin.search")} className="flex-1 rounded-card border border-line px-3 py-2 text-sm" />
        <button className="rounded-card border border-line px-3 text-sm">{t("search.button")}</button>
      </form>
      {rows.length === 0 ? <p className="text-ink-2">{t("admin.empty")}</p> : (
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full text-sm" data-testid="orders-table">
            <thead className="border-b border-line text-left text-xs text-ink-2">
              <tr>{(["number", "date", "customer", "total", "status", "payment"] as const).map((c) =>
                <th key={c} className="px-3 py-2 font-medium">{t(`admin.col.${c}`)}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((o) => (
                <tr key={o.id} className="hover:bg-bg">
                  <td className="px-3 py-2 font-mono"><Link href={`/admin/orders/${o.number}`} className="text-accent underline">{o.number}</Link></td>
                  <td className="whitespace-nowrap px-3 py-2">{dt.format(o.createdAt)}</td>
                  <td className="px-3 py-2">{o.customerName}<span className="block text-xs text-ink-2">{formatPhone(o.customerPhone)}</span></td>
                  <td className="whitespace-nowrap px-3 py-2">{formatTetri(o.total)}</td>
                  <td className="px-3 py-2"><StatusBadge status={o.status} /></td>
                  <td className="px-3 py-2"><PayBadge status={o.paymentStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminPage(props: PageProps<"/admin">) {
  return <Suspense fallback={<div className="h-64 animate-pulse rounded-card bg-line/40" />}><Orders {...props} /></Suspense>;
}
