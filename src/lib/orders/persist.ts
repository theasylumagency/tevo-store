import "server-only";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { StoreDatabase } from "@/db";
import { schema } from "@/db";
import type { StoreConfig } from "@/config/store";
import type { CheckoutInput } from "./service";
import type { Quote } from "./quote";

type Transaction = Parameters<Parameters<StoreDatabase["transaction"]>[0]>[0];
const { orders, orderItems, orderEvents } = schema;
const newToken = () => randomBytes(24).toString("base64url");
const B62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const newShortCode = () => Array.from(randomBytes(8), b => B62[b % 62]).join("");

/** Internal persistence only. Callers must authenticate/validate their own quote
 * and hold the relevant locks. Never expose this helper as a server action. */
export async function insertValidatedOrder(tx: Transaction, store: StoreConfig,
  input: Omit<CheckoutInput, "items" | "displayedPrices"> & { termsVersion: string },
  quote: Pick<Quote, "lines" | "subtotal" | "catalogVersion">,
  deliveryFee: number, eventNote?: string) {
  const online = input.paymentMethod !== "cash";
  const total = quote.subtotal + deliveryFee;
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
    shortCode: newShortCode(),
    termsVersion: input.termsVersion,
    consentedAt: new Date(),
    catalogVersion: quote.catalogVersion,
  }).returning();
  const number = `${store.orderPrefix}-${100000 + row.seq}`;
  const [withNumber] = await tx.update(orders).set({ number }).where(eq(orders.id, row.id)).returning();
  await tx.insert(orderItems).values(quote.lines.map((l) => ({
    orderId: row.id, productId: l.productId, slug: l.slug, name: l.name, model: l.model, brand: l.brand,
    unitPrice: l.unitPrice, quantity: l.qty, lineTotal: l.lineTotal,
  })));
  await tx.insert(orderEvents).values({ orderId: row.id, type: "created", toStatus: withNumber.status, actor: "customer", note: eventNote ?? null });
  return withNumber;
}
