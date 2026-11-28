import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getStore } from "@/config/store";
import { getDb, schema } from "@/db";
import { normalizePhone } from "@/lib/phone";
import { readPublication } from "@/lib/catalog/published";
import { nextRequestStatuses, REQUEST_STATUSES, snapshotRequestLines, type RequestStatus } from "./model";

const requests = schema.purchaseRequests;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const validRequestId = (id: string) => idPattern.test(id);
export const newRequestToken = () => randomBytes(32).toString("base64url");
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

const inputSchema = z.object({
  token: z.string().regex(tokenPattern),
  items: z.array(z.object({ productId: z.string().min(1).max(64), qty: z.number().int().min(1).max(999) })).min(1).max(30),
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(40),
  deliveryMethod: z.enum(["pickup", "delivery", "undecided"]),
  locality: z.string().trim().max(160),
  question: z.string().trim().max(1000),
});
export class RequestError extends Error {}

export async function createPurchaseRequest(input: unknown) {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw new RequestError("შეამოწმეთ საკონტაქტო ინფორმაცია და არჩეული პროდუქტები.");
  const data = parsed.data;
  const phone = normalizePhone(data.phone);
  if (!phone) throw new RequestError("ტელეფონის ნომერი არასწორია.");
  const store = getStore();
  if (data.deliveryMethod !== "undecided" && !store.deliveryMethods.includes(data.deliveryMethod)) {
    throw new RequestError("მიღების ეს წესი მიუწვდომელია.");
  }
  const tokenHash = hashToken(data.token);
  const db = await getDb();
  const identity = and(eq(requests.storeId, store.id), eq(requests.tokenHash, tokenHash));
  const findExisting = async () => (await db.select({ id: requests.id }).from(requests).where(identity))[0];
  const existing = await findExisting();
  if (existing) return { id: existing.id, token: data.token };

  // The current publication supplies identity, price and availability; browser
  // snapshots are display-only. A request is neither a sale nor a reservation.
  const catalog = await readPublication();
  const lines = snapshotRequestLines(catalog.products, data.items, store.maxQuantityPerLine);
  if (!lines) throw new RequestError("არჩევანი შეიცვალა ან რაოდენობა მიუწვდომელია. გადახედეთ პროდუქტებს.");
  const now = new Date();
  const [created] = await db.insert(requests).values({
    storeId: store.id, tokenHash, status: "new", customerName: data.name, customerPhone: phone,
    deliveryMethod: data.deliveryMethod, locality: data.deliveryMethod === "pickup" ? null : data.locality || null,
    question: data.question || null, lines, catalogVersion: catalog.generated_at,
    history: [{ status: "new", response: null, at: now.toISOString() }], createdAt: now, updatedAt: now,
  }).onConflictDoNothing({ target: [requests.storeId, requests.tokenHash] }).returning({ id: requests.id });
  const row = created ?? await findExisting();
  if (!row) throw new Error("request insert failed");
  return { id: row.id, token: data.token };
}

export async function getPublicRequest(id: string, token: string | undefined) {
  if (!validRequestId(id) || !token || !tokenPattern.test(token)) return null;
  const db = await getDb();
  const [row] = await db.select({
    id: requests.id, status: requests.status, lines: requests.lines, deliveryMethod: requests.deliveryMethod,
    question: requests.question, response: requests.response, createdAt: requests.createdAt, updatedAt: requests.updatedAt,
  }).from(requests).where(and(eq(requests.id, id), eq(requests.storeId, getStore().id), eq(requests.tokenHash, hashToken(token))));
  return row ?? null;
}

export async function listPurchaseRequests(status?: RequestStatus) {
  const db = await getDb();
  return db.select({ id: requests.id, status: requests.status, name: requests.customerName,
    phone: requests.customerPhone, lines: requests.lines, createdAt: requests.createdAt, updatedAt: requests.updatedAt })
    .from(requests).where(and(eq(requests.storeId, getStore().id), status ? eq(requests.status, status) : undefined))
    .orderBy(desc(requests.createdAt)).limit(100);
}

export async function getAdminRequest(id: string) {
  if (!validRequestId(id)) return null;
  const db = await getDb();
  const [row] = await db.select().from(requests).where(and(eq(requests.id, id), eq(requests.storeId, getStore().id)));
  return row ?? null;
}

export async function updatePurchaseRequest(id: string, revision: number, status: RequestStatus, response: string) {
  if (!validRequestId(id) || !Number.isSafeInteger(revision) || revision < 0 ||
      !REQUEST_STATUSES.includes(status) || response.length > 2000) return "invalid" as const;
  const current = await getAdminRequest(id);
  if (!current || current.revision !== revision) return "conflict" as const;
  if (!nextRequestStatuses(current.status).includes(status)) return "invalid" as const;
  const reply = response.trim();
  if (status === "answered" && !reply) return "invalid" as const;
  const publicResponse = status === "answered" || status === "closed" ? reply || current.response : current.response;
  const now = new Date();
  const db = await getDb();
  const [updated] = await db.update(requests).set({
    status, response: publicResponse, revision: revision + 1, updatedAt: now,
    history: [...current.history, { status, response: publicResponse, at: now.toISOString() }],
  }).where(and(eq(requests.id, id), eq(requests.storeId, getStore().id), eq(requests.revision, revision)))
    .returning({ id: requests.id });
  return updated ? "saved" as const : "conflict" as const;
}
