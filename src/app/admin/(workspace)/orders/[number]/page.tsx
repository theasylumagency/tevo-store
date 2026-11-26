import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth/admin";
import { getOrderAdmin } from "@/lib/orders/service";
import { notificationsForOrder } from "@/lib/messaging/outbox";
import { TRANSITIONS, type OrderStatus } from "@/lib/orders/status";
import { addNoteAction, changeStatusAction } from "@/app/actions/admin";
import { OrderSummary, PayBadge, StatusBadge } from "@/components/OrderSummary";
import { formatTetri } from "@/lib/money";
import { t, type MessageKey } from "@/i18n";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

const dt = new Intl.DateTimeFormat("ka-GE", { dateStyle: "short", timeStyle: "medium", timeZone: "Asia/Tbilisi" });

async function Detail({ params }: PageProps<"/admin/orders/[number]">) {
  await connection();
  if (!(await isAdmin())) redirect("/admin/login");
  const { number } = await params;
  const data = await getOrderAdmin(number);
  if (!data) notFound();
  const { order, items, payments, events } = data;
  const notes = await notificationsForOrder(order.id);
  const next = TRANSITIONS[order.status as OrderStatus] ?? [];

  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-sm text-ink-2">{t("admin.back")}</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{order.number}</h1>
        <span data-testid="admin-status"><StatusBadge status={order.status} /></span>
        <PayBadge status={order.paymentStatus} />
        <span className="text-sm text-ink-2">{dt.format(order.createdAt)}</span>
      </div>

      <section className="rounded-card border border-line bg-surface p-4">
        <h2 className="mb-3 font-semibold">{t("admin.change_status")}</h2>
        {next.length === 0 ? <p className="text-sm text-ink-2">{t("admin.no_transitions")}</p> : (
          <form action={changeStatusAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="number" value={order.number!} />
            <input name="note" placeholder={t("admin.note")} className="min-w-60 flex-1 rounded-card border border-line px-3 py-2 text-sm" />
            {next.map((s) => (
              <button key={s} name="to" value={s} data-testid={`to-${s}`}
                      className={`rounded-card px-3 py-2 text-sm ${s === "cancelled" ? "border border-warn text-warn" : "bg-accent text-accent-ink"}`}>
                → {t(`status.${s}` as MessageKey)}
              </button>
            ))}
          </form>
        )}
      </section>

      <OrderSummary order={order} items={items} />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-card border border-line bg-surface p-4">
          <h2 className="mb-3 font-semibold">{t("admin.history")}</h2>
          <ol className="space-y-2 text-sm">
            {events.map((e) => (
              <li key={e.id} className="border-l-2 border-line pl-3">
                <span className="text-xs text-ink-2">{dt.format(e.createdAt)} · {t(`admin.actor.${e.actor}` as MessageKey)}</span>
                <span className="block">
                  {e.toStatus ? <>{e.fromStatus ? `${t(`status.${e.fromStatus}` as MessageKey)} → ` : ""}{t(`status.${e.toStatus}` as MessageKey)}</> : null}
                  {e.note ? <span className="block text-ink-2">{e.note}</span> : null}
                </span>
              </li>
            ))}
          </ol>
          <form action={addNoteAction} className="mt-4 flex gap-2">
            <input type="hidden" name="number" value={order.number!} />
            <input name="note" placeholder={t("admin.add_note")} className="flex-1 rounded-card border border-line px-3 py-2 text-sm" />
            <button className="rounded-card border border-line px-3 text-sm">{t("admin.save")}</button>
          </form>
        </section>
        <section className="rounded-card border border-line bg-surface p-4">
          <h2 className="mb-3 font-semibold">{t("admin.payments")}</h2>
          <ul className="space-y-1 text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex justify-between gap-2">
                <span>{p.provider} · {p.method} · <span className="font-mono text-xs">{p.providerRef}</span></span>
                <span>{formatTetri(p.amount)} · {p.status}</span>
              </li>
            ))}
            {!payments.length && <li className="text-ink-2">—</li>}
          </ul>
          <h2 className="mb-3 mt-6 font-semibold">{t("admin.notifications")}</h2>
          <ul className="space-y-2 text-sm" data-testid="admin-notifications">
            {notes.map((n) => (
              <li key={n.id} className="border-l-2 border-line pl-3">
                <span className="text-xs text-ink-2">{dt.format(n.createdAt)} · {n.channel.toUpperCase()} · {n.audience} · {n.recipient}</span>
                <span className="block">{n.subject ?? (n.channel === "telegram" ? n.body.split("\n")[0].replace(/<[^>]+>/g, "") : n.body)}</span>
                <span className={`text-xs ${n.status === "sent" ? "text-accent" : n.status === "failed" ? "text-warn" : "text-ink-2"}`}>
                  {t(`admin.notif.${n.status}` as MessageKey)}{n.attempts > 1 ? ` (${n.attempts})` : ""}{n.lastError ? ` — ${n.lastError}` : ""}
                </span>
              </li>
            ))}
            {!notes.length && <li className="text-ink-2">—</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}

export default function AdminOrderPage(props: PageProps<"/admin/orders/[number]">) {
  return <Suspense fallback={<div className="h-64 animate-pulse rounded-card bg-line/40" />}><Detail {...props} /></Suspense>;
}
