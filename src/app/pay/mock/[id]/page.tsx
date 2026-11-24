import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getPayment } from "@/lib/orders/service";
import { mockPayAction } from "@/app/actions/checkout";
import { paymentsMode } from "@/lib/payments/providers";
import { formatTetri } from "@/lib/money";
import { t, type MessageKey } from "@/i18n";

export const metadata: Metadata = { title: t("mock.title"), robots: { index: false, follow: false } };

async function MockBank({ params }: PageProps<"/pay/mock/[id]">) {
  await connection();
  const { id } = await params;
  const found = paymentsMode() === "test" ? await getPayment(id) : null;
  if (!found || found.payment.provider !== "mock") return <p className="py-16 text-center text-ink-2">{t("order.not_found")}</p>;
  const { payment, order } = found;
  const done = payment.status !== "pending" && payment.status !== "created";
  return (
    <div className="mx-auto max-w-md space-y-5 rounded-card border-2 border-dashed border-warn bg-surface p-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-warn">{t("mock.title")}</p>
        <h1 className="text-xl font-bold">{order.number} · {t(`checkout.payment.${payment.method}` as MessageKey)}</h1>
        <p className="mt-1 text-sm text-ink-2">{t("mock.lead")}</p>
      </div>
      <p className="text-3xl font-semibold">{t("mock.amount")}: {formatTetri(payment.amount)}</p>
      {done ? <p className="text-sm">{payment.status}</p> : (
        <form action={mockPayAction} className="grid gap-2">
          <input type="hidden" name="paymentId" value={payment.id} />
          <button name="outcome" value="succeeded" data-testid="mock-success" className="rounded-card bg-accent px-4 py-3 text-accent-ink">{t("mock.success")}</button>
          <button name="outcome" value="failed" data-testid="mock-fail" className="rounded-card border border-warn px-4 py-3 text-warn">{t("mock.fail")}</button>
          <button name="outcome" value="cancelled" className="px-4 py-2 text-sm text-ink-2">{t("mock.cancel")}</button>
        </form>
      )}
    </div>
  );
}

export default function MockPayPage(props: PageProps<"/pay/mock/[id]">) {
  return <Suspense fallback={null}><MockBank {...props} /></Suspense>;
}
