import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { and, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Order } from "@/db/schema";
import { getStore, type DeliveryMethod, type PaymentMethod } from "@/config/store";
import { notify } from "@/lib/notify";
import { providerById, providerFor } from "@/lib/payments/providers";
import type { OnlineMethod, PaymentOutcome } from "@/lib/payments/types";
import { quoteCart, type CartInputLine, type QuoteProblem } from "./quote";
import { canTransition, type OrderStatus } from "./status";

const { orders, orderItems, orderEvents, payments } = schema;

export interface CheckoutInput {
  items: CartInputLine[];
  name: string;
  phone: string;           // normalised +995XXXXXXXXX
  email?: string | null;
  deliveryMethod: DeliveryMethod;
  region?: string | null;
  city?: string | null;
  address?: string | null;
  comment?: string | null;
  paymentMethod: PaymentMethod;
}

export class CheckoutError extends Error {
  constructor(public code: "empty_cart" | "cart_changed" | "method_unavailable", public problems: QuoteProblem[] = []) {
    super(code);
  }
}

const baseUrl = () => (process.env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const newToken = () => randomBytes(24).toString("base64url");

export function orderUrl(o: Pick<Order, "number" | "accessToken">) {
  return `/order/${o.number}?t=${o.accessToken}`;
}

export async function createOrder(input: CheckoutInput, opts: { acceptChanges?: boolean } = {}) {
  const store = getStore();
  if (!store.paymentMethods.includes(input.paymentMethod) || !store.deliveryMethods.includes(input.deliveryMethod)) {
    throw new CheckoutError("method_unavailable");
  }
  const online = input.paymentMethod !== "cash";
  if (online && !providerFor(input.paymentMethod as OnlineMethod, store.id)) throw new CheckoutError("method_unavailable");

  const quote = await quoteCart(input.items);
  if (!quote.lines.length) throw new CheckoutError("empty_cart", quote.problems);
  if (quote.problems.length && !opts.acceptChanges) throw new CheckoutError("cart_changed", quote.problems);

  const deliveryFee = input.deliveryMethod === "delivery" ? quote.deliveryFee : 0;
  const total = quote.subtotal + (deliveryFee ?? 0);
  const db = await getDb();

  const order = await db.transaction(async (tx) => {
    const [row] = await tx.insert(orders).values({
      storeId: store.id,
      status: online ? "pending_payment" : "new",
      paymentMethod: input.paymentMethod,
      paymentStatus: online ? "pending" : "unpaid",
      customerName: input.name,
      customerPhone: input.phone,
      customerEmail: input.email || null,
      deliveryMethod: input.deliveryMethod,
      region: input.deliveryMethod === "delivery" ? input.region || null : null,
      city: input.deliveryMethod === "delivery" ? input.city || null : null,
      address: input.deliveryMethod === "delivery" ? input.address || null : null,
      comment: input.comment || null,
      subtotal: quote.subtotal,
      deliveryFee,
      total,
      accessToken: newToken(),
      catalogVersion: quote.catalogVersion,
    }).returning();
    const number = `${store.orderPrefix}-${100000 + row.seq}`;
    const [withNumber] = await tx.update(orders).set({ number }).where(eq(orders.id, row.id)).returning();
    await tx.insert(orderItems).values(quote.lines.map((l) => ({
      orderId: row.id, productId: l.productId, slug: l.slug, name: l.name, model: l.model, brand: l.brand,
      unitPrice: l.unitPrice, quantity: l.qty, lineTotal: l.lineTotal,
    })));
    await tx.insert(orderEvents).values({ orderId: row.id, type: "created", toStatus: withNumber.status, actor: "customer" });
    return withNumber;
  });

  await notify("order_created", order);
  const redirectUrl = online ? await startPayment(order, input.paymentMethod as OnlineMethod) : orderUrl(order);
  return { order, redirectUrl };
}

/** Creates a payment attempt at the bank and returns where to send the customer. Also used for retries. */
export async function startPayment(order: Order, method: OnlineMethod) {
  const provider = providerFor(method, order.storeId);
  if (!provider) throw new CheckoutError("method_unavailable");
  const db = await getDb();
  const [pay] = await db.insert(payments).values({
    orderId: order.id, provider: provider.id, method, status: "created", amount: order.total, currency: order.currency,
  }).returning();
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  try {
    const res = await provider.create({
      paymentId: pay.id, orderNumber: order.number!, amount: order.total, currency: "GEL", method, storeId: order.storeId,
      returnUrl: `${baseUrl()}${orderUrl(order)}`,
      callbackUrl: `${baseUrl()}/api/payments/${provider.id}/callback`,
      items: items.map((i) => ({ name: i.name, qty: i.quantity, unitPrice: i.unitPrice, productId: i.productId })),
    });
    await db.update(payments).set({ status: "pending", providerRef: res.providerRef, redirectUrl: res.redirectUrl,
                                    raw: (res.raw ?? null) as never, updatedAt: new Date() }).where(eq(payments.id, pay.id));
    await db.update(orders).set({ paymentStatus: "pending", updatedAt: new Date() }).where(eq(orders.id, order.id));
    return res.redirectUrl;
  } catch (e) {
    await db.update(payments).set({ status: "failed", raw: { error: String(e) } as never, updatedAt: new Date() })
      .where(eq(payments.id, pay.id));
    throw e;
  }
}

/** Idempotent: a bank may call back more than once. Final states are never overwritten. */
export async function applyPaymentResult(paymentId: string, outcome: PaymentOutcome, raw?: unknown) {
  if (outcome === "pending") return null;
  const db = await getDb();
  const result = await db.transaction(async (tx) => {
    const [pay] = await tx.select().from(payments).where(eq(payments.id, paymentId)).for("update");
    if (!pay || pay.status === "succeeded" || pay.status === "failed" || pay.status === "cancelled") return null;
    await tx.update(payments).set({ status: outcome, raw: (raw ?? pay.raw) as never, updatedAt: new Date() })
      .where(eq(payments.id, pay.id));
    const [order] = await tx.select().from(orders).where(eq(orders.id, pay.orderId)).for("update");
    if (outcome === "succeeded") {
      const status = order.status === "pending_payment" ? "new" : order.status;
      const [o] = await tx.update(orders).set({ paymentStatus: "paid", status, updatedAt: new Date() })
        .where(eq(orders.id, order.id)).returning();
      await tx.insert(orderEvents).values({ orderId: order.id, type: "payment", fromStatus: order.status, toStatus: status,
                                            note: `გადახდა მიღებულია (${pay.provider}, ${pay.method})`, actor: "payment" });
      return { order: o, event: "payment_succeeded" as const };
    }
    const paid = order.paymentStatus === "paid";
    const [o] = await tx.update(orders).set({ paymentStatus: paid ? "paid" : "failed", updatedAt: new Date() })
      .where(eq(orders.id, order.id)).returning();
    await tx.insert(orderEvents).values({ orderId: order.id, type: "payment", note:
      outcome === "cancelled" ? "გადახდა გაუქმდა" : "გადახდა ვერ შესრულდა", actor: "payment" });
    return { order: o, event: "payment_failed" as const };
  });
  if (result) await notify(result.event, result.order);
  return result?.order ?? null;
}

export async function handleProviderCallback(providerId: string, req: Request) {
  const storeId = getStore().id;
  const provider = providerById(providerId, storeId);
  if (!provider) return { ok: false as const, status: 404 };
  const res = await provider.resolveCallback(req);
  if (!res) return { ok: false as const, status: 400 };
  await applyPaymentResult(res.paymentId, res.outcome, res.raw);
  return { ok: true as const, status: 200 };
}

function sameToken(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

async function loadOrder(where: ReturnType<typeof eq>) {
  const db = await getDb();
  const [order] = await db.select().from(orders).where(where);
  if (!order) return null;
  const [items, pays, events] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, order.id)).orderBy(orderItems.id),
    db.select().from(payments).where(eq(payments.orderId, order.id)).orderBy(desc(payments.createdAt)),
    db.select().from(orderEvents).where(eq(orderEvents.orderId, order.id)).orderBy(orderEvents.id),
  ]);
  return { order, items, payments: pays, events };
}

/** Customer view: the order number alone is not enough, the secret link token is required. */
export async function getOrderForCustomer(number: string, token: string | undefined) {
  if (!token) return null;
  const data = await loadOrder(eq(orders.number, number));
  if (!data || !sameToken(data.order.accessToken, token)) return null;
  return data;
}

export async function getPayment(paymentId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(paymentId)) return null;
  const db = await getDb();
  const [pay] = await db.select().from(payments).where(eq(payments.id, paymentId));
  if (!pay) return null;
  const [order] = await db.select().from(orders).where(eq(orders.id, pay.orderId));
  return { payment: pay, order };
}

// ---------- admin ----------

export async function getOrderAdmin(number: string) {
  return loadOrder(eq(orders.number, number));
}

export async function listOrders(opts: { status?: string; q?: string; limit?: number } = {}) {
  const db = await getDb();
  const conds = [eq(orders.storeId, getStore().id)];
  if (opts.status) conds.push(eq(orders.status, opts.status));
  if (opts.q) {
    const like = `%${opts.q.replace(/[%_]/g, "")}%`;
    conds.push(or(ilike(orders.number, like), ilike(orders.customerName, like), ilike(orders.customerPhone, like))!);
  }
  const rows = await db.select().from(orders).where(and(...conds)).orderBy(desc(orders.createdAt)).limit(opts.limit ?? 100);
  const counts = await db.select({ status: orders.status, n: sql<number>`count(*)::int` }).from(orders)
    .where(eq(orders.storeId, getStore().id)).groupBy(orders.status);
  return { rows, counts: Object.fromEntries(counts.map((c) => [c.status, c.n])) as Record<string, number> };
}

export async function changeStatus(number: string, to: OrderStatus, note: string | null, actor = "admin") {
  const db = await getDb();
  const order = await db.transaction(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.number, number)).for("update");
    if (!o) throw new Error("not_found");
    if (!canTransition(o.status, to)) throw new Error("bad_transition");
    const [u] = await tx.update(orders).set({ status: to, updatedAt: new Date() }).where(eq(orders.id, o.id)).returning();
    await tx.insert(orderEvents).values({ orderId: o.id, type: "status", fromStatus: o.status, toStatus: to,
                                          note: note || null, actor });
    return u;
  });
  await notify("status_changed", order);
  return order;
}

export async function addNote(number: string, note: string, actor = "admin") {
  const db = await getDb();
  const [o] = await db.select({ id: orders.id }).from(orders).where(eq(orders.number, number));
  if (!o || !note.trim()) return;
  await db.insert(orderEvents).values({ orderId: o.id, type: "note", note: note.trim().slice(0, 2000), actor });
}

// ---------- Khidi outbox (pull) ----------

export async function unsyncedOrders(limit = 50) {
  const db = await getDb();
  const rows = await db.select().from(orders)
    .where(and(isNull(orders.khidiSyncedAt), inArray(orders.status, ["new", "confirmed", "ready_for_pickup", "shipped", "completed", "cancelled"])))
    .orderBy(orders.createdAt).limit(limit);
  const items = rows.length
    ? await db.select().from(orderItems).where(inArray(orderItems.orderId, rows.map((r) => r.id))) : [];
  return rows.map((row) => {
    const { accessToken, ...o } = row;
    void accessToken;   // never leaves the store
    return { ...o, items: items.filter((i) => i.orderId === o.id) };
  });
}

export async function markSynced(ids: string[]) {
  if (!ids.length) return 0;
  const db = await getDb();
  const res = await db.update(orders).set({ khidiSyncedAt: new Date() }).where(inArray(orders.id, ids)).returning({ id: orders.id });
  return res.length;
}
