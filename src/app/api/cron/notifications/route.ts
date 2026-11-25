import { timingSafeEqual } from "node:crypto";
import { dispatch } from "@/lib/messaging/outbox";

/**
 * Retries queued / failed notifications. Call every minute from the server's cron:
 *   * * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_TOKEN" https://tevo.ge/api/cron/notifications
 */
export async function POST(req: Request) {
  const expected = process.env.CRON_TOKEN ?? "";
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(got), b = Buffer.from(expected);
  if (expected.length < 16 || a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return Response.json(await dispatch(undefined, 100));
}
