import { timingSafeEqual } from "node:crypto";
import { markSynced, unsyncedOrders } from "@/lib/orders/service";

/**
 * Khidi pulls new orders from here (and the warehouse from Khidi).
 *   GET  → orders not yet acknowledged
 *   POST {"ids": [...]} → acknowledge
 * Auth: Authorization: Bearer $OUTBOX_TOKEN
 */
function authorized(req: Request) {
  const expected = process.env.OUTBOX_TOKEN;
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || expected.length < 16) return false;
  const a = Buffer.from(got), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!authorized(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({ orders: await unsyncedOrders() });
}

export async function POST(req: Request) {
  if (!authorized(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((x): x is string => typeof x === "string").slice(0, 500) : [];
  return Response.json({ acknowledged: await markSynced(ids) });
}
