import "server-only";
import type { Order, OrderItem } from "@/db/schema";
import type { StoreConfig } from "@/config/store";
import { formatTetri } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { t, type MessageKey } from "@/i18n";

export type MessageEvent = "order_created" | "payment_succeeded" | "payment_failed" | "status_changed";

export interface OutgoingMessage {
  channel: "sms" | "email";
  audience: "customer" | "staff";
  recipient: string;
  subject?: string;
  body: string;
  html?: string;
  dedupe: string;          // unique per order + event + channel + recipient
}

const esc = (s: string | null | undefined) =>
  (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function baseUrl() {
  return (process.env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** Short customer link for SMS: rodo.ge/o/Ab3dE9xQ (scheme dropped to save characters). */
export function shortLink(o: Order) {
  const url = `${baseUrl()}/o/${o.shortCode}`;
  return url.replace(/^https:\/\//, "");
}

/** Statuses the customer hears about. "completed" is silent on purpose. */
const STATUS_TEXT: Partial<Record<string, MessageKey>> = {
  confirmed: "msg.status.confirmed",
  ready_for_pickup: "msg.status.ready_for_pickup",
  shipped: "msg.status.shipped",
  cancelled: "msg.status.cancelled",
};

function itemsTable(items: OrderItem[], o: Order) {
  const rows = items.map((i) => `<tr><td style="padding:6px 0">${esc(i.name)} × ${i.quantity}</td>
    <td style="padding:6px 0;text-align:right;white-space:nowrap">${formatTetri(i.lineTotal)}</td></tr>`).join("");
  const fee = o.deliveryFee === null ? t("cart.delivery.by_phone") : o.deliveryFee === 0 ? t("cart.delivery.free") : formatTetri(o.deliveryFee);
  return `<table style="width:100%;border-collapse:collapse;font-size:14px">${rows}
    <tr><td style="padding:6px 0;border-top:1px solid #ddd;color:#666">${t("cart.delivery")}</td>
        <td style="padding:6px 0;border-top:1px solid #ddd;text-align:right">${esc(fee)}</td></tr>
    <tr><td style="padding:6px 0;font-weight:bold">${t("cart.total")}</td>
        <td style="padding:6px 0;text-align:right;font-weight:bold">${formatTetri(o.total)}</td></tr></table>`;
}

function emailShell(store: StoreConfig, title: string, inner: string) {
  return `<!doctype html><html lang="ka"><body style="margin:0;background:#f6f5f2;font-family:Arial,sans-serif;color:#1d1f1c">
<div style="max-width:560px;margin:0 auto;padding:24px"><div style="background:#fff;border:1px solid #e3e1db;border-radius:10px;padding:24px">
<p style="margin:0 0 4px;color:#5a5f57;font-size:13px">${esc(store.name)}</p>
<h1 style="margin:0 0 16px;font-size:20px">${esc(title)}</h1>${inner}</div>
<p style="color:#5a5f57;font-size:12px;margin-top:12px">${esc(store.contact.phone ?? "")} ${esc(store.contact.email ?? "")}</p></div></body></html>`;
}

function textItems(items: OrderItem[], o: Order) {
  return items.map((i) => `- ${i.name} × ${i.quantity}: ${formatTetri(i.lineTotal)}`).join("\n") + `\n${t("cart.total")}: ${formatTetri(o.total)}`;
}

/** All messages an event produces. Pure function: easy to read, easy to test. */
export function buildMessages(event: MessageEvent, o: Order, items: OrderItem[], store: StoreConfig,
                              staff: { emails: string[]; phones: string[] }): OutgoingMessage[] {
  const out: OutgoingMessage[] = [];
  const n = o.number!;
  const vars = { store: store.shortName, n, total: formatTetri(o.total)!, link: shortLink(o),
                 phone: store.contact.phone ?? "", status: t(`status.${o.status}` as MessageKey) };
  const orderLink = `${baseUrl()}/o/${o.shortCode}`;
  const key = (suffix: string, ch: string, to: string) => `${o.id}:${suffix}:${ch}:${to}`;
  const customerSms = (suffix: string, textKey: MessageKey) =>
    out.push({ channel: "sms", audience: "customer", recipient: o.customerPhone,
               body: `${store.shortName}: ${t(textKey, vars)} ${vars.link}`, dedupe: key(suffix, "sms", o.customerPhone) });
  const customerEmail = (suffix: string, subjectKey: MessageKey, leadKey: MessageKey) => {
    if (!o.customerEmail) return;
    const subject = t(subjectKey, vars), lead = t(leadKey, vars);
    out.push({ channel: "email", audience: "customer", recipient: o.customerEmail, subject,
      body: `${lead}\n\n${textItems(items, o)}\n\n${t("msg.email.link")}: ${orderLink}`,
      html: emailShell(store, subject, `<p style="margin:0 0 16px">${esc(lead)}</p>${itemsTable(items, o)}
        <p style="margin:20px 0 0"><a href="${orderLink}" style="background:#2f6b3a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">${t("msg.email.link")}</a></p>`),
      dedupe: key(suffix, "email", o.customerEmail) });
  };
  const staffNew = () => {
    const subject = t("msg.staff.subject", vars);
    const admin = `${baseUrl()}/admin/orders/${n}`;
    const who = `${o.customerName}, ${formatPhone(o.customerPhone)}`;
    const where = o.deliveryMethod === "delivery" ? [o.region, o.city, o.address].filter(Boolean).join(", ") : t("checkout.delivery.pickup");
    const pay = `${t(`checkout.payment.${o.paymentMethod}` as MessageKey)} — ${t(`pay.${o.paymentStatus}` as MessageKey)}`;
    for (const to of staff.emails) {
      out.push({ channel: "email", audience: "staff", recipient: to, subject,
        body: `${who}\n${where}\n${pay}\n\n${textItems(items, o)}${o.comment ? `\n\n„${o.comment}“` : ""}\n\n${admin}`,
        html: emailShell(store, subject, `<p style="margin:0 0 4px"><b>${esc(o.customerName)}</b>, ${esc(formatPhone(o.customerPhone))}</p>
          <p style="margin:0 0 4px;color:#5a5f57">${esc(where)}</p><p style="margin:0 0 16px;color:#5a5f57">${esc(pay)}</p>
          ${itemsTable(items, o)}${o.comment ? `<p style="font-style:italic">„${esc(o.comment)}“</p>` : ""}
          <p style="margin:20px 0 0"><a href="${admin}">${admin}</a></p>`),
        dedupe: key("staff_new", "email", to) });
    }
    for (const to of staff.phones) {
      out.push({ channel: "sms", audience: "staff", recipient: to, body: t("msg.staff.sms", { ...vars, who }),
                 dedupe: key("staff_new", "sms", to) });
    }
  };

  if (event === "order_created" && o.status === "new") {           // cash: confirmed right away
    customerSms("created", "msg.sms.created");
    customerEmail("created", "msg.email.created.subject", "msg.email.created.lead");
    staffNew();
  }
  if (event === "payment_succeeded") {
    customerSms("paid", "msg.sms.paid");
    customerEmail("paid", "msg.email.paid.subject", "msg.email.paid.lead");
    staffNew();
  }
  if (event === "payment_failed" && o.paymentStatus === "failed") {
    customerSms("payment_failed", "msg.sms.payment_failed");
  }
  if (event === "status_changed") {
    const k = STATUS_TEXT[o.status];
    if (k) {
      customerSms(`status_${o.status}`, k);
      customerEmail(`status_${o.status}`, "msg.email.status.subject", k);
    }
  }
  return out;
}
