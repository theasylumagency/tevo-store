import { dispatch } from "@/lib/messaging/outbox";
import { hasBearer } from "@/lib/auth/bearer";

/**
 * Retries queued / failed notifications. Call every minute from the server's cron:
 *   * * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_TOKEN" https://rodo.ge/api/cron/notifications
 */
export async function POST(req: Request) {
  if (!hasBearer(req, "CRON_TOKEN")) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json(await dispatch(undefined, 100));
}
