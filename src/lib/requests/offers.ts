import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { GEORGIA_REGIONS, getStore } from "@/config/store";
import { notify } from "@/lib/notify";
import { insertValidatedOrder } from "@/lib/orders/persist";
import { orderUrl } from "@/lib/orders/service";
import { hashToken, tokenPattern, validRequestId } from "./service";
import { activeOffer, offerLines, offerStockStillValid, type OfferVersion } from "./offer-model";

const requests = schema.purchaseRequests;
const inputSchema = z.object({
  prices: z.record(z.string(), z.number().int().positive().max(2_147_483_647)),
  deliveryMethod: z.enum(["pickup", "delivery"]),
  region: z.string().trim().max(80),
  city: z.string().trim().max(120),
  address: z.string().trim().min(3).max(300),
  fulfilment: z.string().trim().min(3).max(300),
  deliveryFee: z.number().int().nonnegative().max(2_147_483_647),
  expiresHours: z.number().int().refine(n => [1, 6, 12, 24, 48, 72].includes(n)),
  stockEvidence: z.string().trim().min(5).max(500),
  confirmed: z.literal(true),
});
export type OfferResult = "saved" | "invalid" | "conflict" | "unavailable" | "expired" | "terms_changed" | "rejected" | "clarification" | "withdrawn" | "accepted";

/** Staff-confirmed complete terms. This does not edit canonical catalog stock/price. */
export async function issueOffer(id: string, revision: number, input: unknown): Promise<OfferResult> {
  const parsed = inputSchema.safeParse(input);
  if (!validRequestId(id) || !Number.isSafeInteger(revision) || revision < 0 || !parsed.success) return "invalid";
  const v = parsed.data;
  const store = getStore();
  if (!store.paymentMethods.includes("cash") || !store.deliveryMethods.includes(v.deliveryMethod)) return "invalid";
  if (v.deliveryMethod === "pickup" ? v.deliveryFee !== 0
    : !(GEORGIA_REGIONS as readonly string[]).includes(v.region) || !v.city) return "invalid";
  const db = await getDb();
  return db.transaction(async tx => {
    const [request] = await tx.select().from(requests)
      .where(and(eq(requests.id, id), eq(requests.storeId, store.id))).for("update");
    if (!request || request.revision !== revision) return "conflict";
    if (request.status === "closed" || request.convertedOrderId || request.offers.length >= 30) return "invalid";
    const [publication] = await tx.select({ catalog: schema.storeCatalogs.published }).from(schema.storeCatalogs)
      .where(eq(schema.storeCatalogs.storeId, store.id)).for("share");
    if (!publication) return "unavailable";
    const lines = offerLines(publication.catalog, request.lines, v.prices, store.maxQuantityPerLine);
    if (!lines) return "unavailable";
    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const total = subtotal + v.deliveryFee;
    if (!Number.isSafeInteger(total) || total > 2_147_483_647) return "invalid";
    const now = new Date();
    const stamp = now.toISOString();
    const previous = request.offers.map((o): OfferVersion => o.state === "issued" ? { ...o, state: "superseded", decidedAt: stamp } : o);
    const offer: OfferVersion = {
      version: (previous.at(-1)?.version ?? 0) + 1, state: "issued", lines, subtotal, total,
      deliveryMethod: v.deliveryMethod, deliveryFee: v.deliveryFee,
      region: v.deliveryMethod === "delivery" ? v.region : null, city: v.deliveryMethod === "delivery" ? v.city : null,
      address: v.address, fulfilment: v.fulfilment, paymentMethod: "cash",
      issuedAt: stamp, expiresAt: new Date(now.getTime() + v.expiresHours * 3600000).toISOString(),
      catalogVersion: publication.catalog.generated_at, termsVersion: store.termsVersion, stockEvidence: v.stockEvidence,
    };
    await tx.update(requests).set({ offers: [...previous, offer], status: "answered", revision: revision + 1,
      updatedAt: now, history: [...request.history, { status: "answered", response: request.response, at: stamp }] })
      .where(eq(requests.id, id));
    return "saved";
  });
}

export async function withdrawOffer(id: string, revision: number): Promise<OfferResult> {
  if (!validRequestId(id) || !Number.isSafeInteger(revision) || revision < 0) return "invalid";
  const db = await getDb();
  return db.transaction(async tx => {
    const [request] = await tx.select().from(requests)
      .where(and(eq(requests.id, id), eq(requests.storeId, getStore().id))).for("update");
    if (!request || request.revision !== revision) return "conflict";
    const last = request.offers.at(-1);
    if (!last || last.state !== "issued" || request.convertedOrderId) return "invalid";
    const now = new Date();
    const offer: OfferVersion = { ...last, state: "withdrawn", decidedAt: now.toISOString() };
    await tx.update(requests).set({ offers: [...request.offers.slice(0, -1), offer], status: "in_review",
      revision: revision + 1, updatedAt: now,
      history: [...request.history, { status: "in_review", response: request.response, at: now.toISOString() }] }).where(eq(requests.id, id));
    return "withdrawn";
  });
}

export interface CustomerOfferInput {
  id: string; token: string; version: number;
  decision: "accept" | "reject" | "clarify";
  consent: boolean; termsVersion: string; clarification: string;
}
export async function decideOffer(input: CustomerOfferInput): Promise<{ result: OfferResult; redirectUrl?: string }> {
  const { id, token, version, decision } = input;
  if (!validRequestId(id) || !tokenPattern.test(token) || !Number.isSafeInteger(version) || version < 1 ||
      !["accept", "reject", "clarify"].includes(decision) || input.clarification.length > 1000 ||
      (decision === "clarify" && !input.clarification.trim()) || (decision === "accept" && !input.consent)) return { result: "invalid" };
  const store = getStore();
  const db = await getDb();
  const result = await db.transaction(async tx => {
    const [request] = await tx.select().from(requests)
      .where(and(eq(requests.id, id), eq(requests.storeId, store.id), eq(requests.tokenHash, hashToken(token)))).for("update");
    if (!request) return { result: "conflict" as const };
    const offer = request.offers.at(-1);
    if (!offer || offer.version !== version) return { result: "conflict" as const };
    // A retried acceptance returns the same order, never another sale.
    if (decision === "accept" && offer.state === "accepted" && request.convertedOrderId) {
      const [order] = await tx.select().from(schema.orders).where(and(eq(schema.orders.id, request.convertedOrderId), eq(schema.orders.storeId, store.id)));
      return order ? { result: "accepted" as const, redirectUrl: orderUrl(order) } : { result: "conflict" as const };
    }
    if (request.status !== "answered" || offer.state !== "issued" || request.convertedOrderId) return { result: "conflict" as const };
    if (!activeOffer(offer)) return { result: "expired" as const };
    const now = new Date();
    const stamp = now.toISOString();
    if (decision !== "accept") {
      const status = decision === "clarify" ? "in_review" as const : "closed" as const;
      const next: OfferVersion = { ...offer, state: decision === "clarify" ? "clarification" : "rejected", decidedAt: stamp,
        ...(decision === "clarify" ? { clarification: input.clarification.trim() } : {}) };
      await tx.update(requests).set({ offers: [...request.offers.slice(0, -1), next], status, revision: request.revision + 1,
        updatedAt: now, history: [...request.history, { status, response: request.response, at: stamp }] }).where(eq(requests.id, id));
      return { result: next.state as "clarification" | "rejected" };
    }
    if (input.termsVersion !== offer.termsVersion || store.termsVersion !== offer.termsVersion) return { result: "terms_changed" as const };
    if (!store.paymentMethods.includes("cash") || !store.deliveryMethods.includes(offer.deliveryMethod)) return { result: "unavailable" as const };
    const [publication] = await tx.select({ catalog: schema.storeCatalogs.published }).from(schema.storeCatalogs)
      .where(eq(schema.storeCatalogs.storeId, store.id)).for("share");
    if (!publication || !offerStockStillValid(offer, publication.catalog, store.maxQuantityPerLine)) return { result: "unavailable" as const };
    if (!activeOffer(offer)) return { result: "expired" as const };
    const order = await insertValidatedOrder(tx, store, {
      name: request.customerName, phone: request.customerPhone, paymentMethod: "cash", deliveryMethod: offer.deliveryMethod,
      region: offer.region, city: offer.city, address: offer.address, termsVersion: offer.termsVersion,
      comment: "შეთავაზება #" + version + " · " + id + "\n" + (offer.deliveryMethod === "pickup" ? "გატანის მისამართი: " + offer.address + "\n" : "") + offer.fulfilment,
    }, { lines: offer.lines.map(l => ({ ...l, image: null })), subtotal: offer.subtotal, catalogVersion: publication.catalog.generated_at },
    offer.deliveryFee, "მიღებული შეთავაზება #" + version + " · " + id);
    const accepted: OfferVersion = { ...offer, state: "accepted", decidedAt: new Date().toISOString() };
    await tx.update(requests).set({ offers: [...request.offers.slice(0, -1), accepted], convertedOrderId: order.id, status: "closed",
      revision: request.revision + 1, updatedAt: now, history: [...request.history, { status: "closed", response: request.response, at: stamp }] }).where(eq(requests.id, id));
    return { result: "accepted" as const, redirectUrl: orderUrl(order), order };
  });
  // Notifications must follow a committed order, and only the creator queues them.
  if ("order" in result && result.order) await notify("order_created", result.order);
  return { result: result.result, redirectUrl: "redirectUrl" in result ? result.redirectUrl : undefined };
}
