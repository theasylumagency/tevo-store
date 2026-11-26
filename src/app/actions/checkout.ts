"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { GEORGIA_REGIONS, getStore } from "@/config/store";
import { quoteCart, type Quote } from "@/lib/orders/quote";
import { applyPaymentResult, CheckoutError, createOrder, getOrderForCustomer, getPayment, orderUrl, startPayment }
  from "@/lib/orders/service";
import { paymentsMode } from "@/lib/payments/providers";
import type { MessageKey } from "@/i18n";
import { normalizePhone } from "@/lib/phone";

const cartSchema = z.array(z.object({ productId: z.string().max(64), qty: z.number().int().min(1).max(999) })).max(100);

/** Current prices and availability for whatever is in the browser's cart. */
export async function quoteAction(items: unknown): Promise<Quote> {
  const parsed = cartSchema.safeParse(items);
  return quoteCart(parsed.success ? parsed.data : []);
}

const formSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().transform((v, ctx) => {
    const n = normalizePhone(v);
    if (!n) ctx.addIssue({ code: "custom", message: "phone" });
    return n ?? "";
  }),
  email: z.union([z.literal(""), z.email().max(200)]).optional(),
  deliveryMethod: z.enum(["pickup", "delivery"]),
  region: z.string().max(80).optional(),
  city: z.string().trim().max(120).optional(),
  address: z.string().trim().max(300).optional(),
  comment: z.string().trim().max(1000).optional(),
  paymentMethod: z.enum(["card", "installment", "cash"]),
  terms: z.literal("on"),
});

/** Address is required for delivery. Checked separately so every missing field is reported at once. */
function deliveryErrors(v: Record<string, string>) {
  const e: string[] = [];
  if (v.deliveryMethod !== "delivery") return e;
  if (!(GEORGIA_REGIONS as readonly string[]).includes(v.region)) e.push("region");
  if (!v.city.trim()) e.push("city");
  if (!v.address.trim()) e.push("address");
  return e;
}

export interface CheckoutState {
  ok?: boolean;
  redirectUrl?: string;
  formError?: MessageKey;
  fieldErrors?: Partial<Record<string, MessageKey>>;
  quote?: Quote;
  values?: Record<string, string>;
}

export async function placeOrderAction(_prev: CheckoutState, form: FormData): Promise<CheckoutState> {
  const values = Object.fromEntries(
    ["name", "phone", "email", "deliveryMethod", "region", "city", "address", "comment", "paymentMethod", "terms"]
      .map((k) => [k, String(form.get(k) ?? "")]),
  );
  let items: unknown = [];
  try { items = JSON.parse(String(form.get("items") ?? "[]")); } catch { /* treated as empty */ }
  const cart = cartSchema.safeParse(items);
  if (!cart.success || !cart.data.length) return { formError: "checkout.error.empty_cart", values };

  const parsed = formSchema.safeParse(values);
  const missing = deliveryErrors(values);
  if (!parsed.success || missing.length) {
    const fieldErrors: CheckoutState["fieldErrors"] = {};
    for (const issue of parsed.success ? [] : parsed.error.issues) {
      const key = String(issue.path[0]);
      fieldErrors[key] = key === "phone" ? "checkout.error.phone" : key === "email" ? "checkout.error.email"
        : key === "terms" ? "checkout.error.terms" : "checkout.error.required";
    }
    for (const key of missing) fieldErrors[key] = "checkout.error.required";
    return { fieldErrors, values };
  }

  try {
    const { redirectUrl } = await createOrder({ ...parsed.data, items: cart.data, email: parsed.data.email || null,
                                                termsVersion: getStore().termsVersion });
    return { ok: true, redirectUrl };
  } catch (e) {
    if (e instanceof CheckoutError) {
      const quote = e.code === "cart_changed" ? await quoteCart(cart.data) : undefined;
      return { formError: `checkout.error.${e.code}` as MessageKey, quote, values };
    }
    console.error("checkout failed", e);
    return { formError: "checkout.error.generic", values };
  }
}

/** Customer retries a failed online payment from the order page. */
export async function retryPaymentAction(form: FormData) {
  const number = String(form.get("number") ?? "");
  const token = String(form.get("t") ?? "");
  const data = await getOrderForCustomer(number, token);
  if (!data || data.order.paymentStatus === "paid" || data.order.status !== "pending_payment"
      || (data.order.paymentMethod !== "card" && data.order.paymentMethod !== "installment")) {
    redirect(data ? orderUrl(data.order) : "/");
  }
  const url = await startPayment(data.order, data.order.paymentMethod as "card" | "installment");
  redirect(url);
}

/** Test bank only: simulates the bank's answer, then sends the customer back like a real bank would. */
export async function mockPayAction(form: FormData) {
  if (paymentsMode() !== "test") throw new Error("mock payments are disabled");   // off on public production
  const paymentId = String(form.get("paymentId") ?? "");
  const outcome = String(form.get("outcome") ?? "");
  if (!["succeeded", "failed", "cancelled"].includes(outcome)) throw new Error("bad outcome");
  const found = await getPayment(paymentId);
  if (!found || found.payment.provider !== "mock") redirect("/");
  await applyPaymentResult(paymentId, outcome as "succeeded" | "failed" | "cancelled", { simulated: true });
  redirect(orderUrl(found.order));
}
