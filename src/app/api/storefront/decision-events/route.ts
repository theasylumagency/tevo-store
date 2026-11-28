import { getStore } from "@/config/store";
import { isDecisionEvent } from "@/lib/analytics/model";
import { countDecisionEvent } from "@/lib/analytics/service";
import { tooManyAttempts, recordFailure } from "@/lib/auth/rate-limit";

function response(status: number) {
  return new Response(null, { status, headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  const expected = new URL(process.env.PUBLIC_BASE_URL || request.url).origin;
  if ((origin && origin !== expected) || (site && site !== "same-origin") || (!origin && !site)) return response(403);
  if (request.headers.get("dnt") === "1" || request.headers.get("sec-gpc") === "1") return response(204);
  const event = request.headers.get("x-decision-event");
  if (!isDecisionEvent(event)) return response(400);
  // A process-wide ceiling, with no IP or per-visitor identifier in this limiter.
  const store = getStore();
  const key = "decision:" + store.id + ":" + store.showReview;
  if (tooManyAttempts(key, 1200, 60_000)) return response(429);
  recordFailure(key, 60_000);
  try {
    await countDecisionEvent(event);
    return response(204);
  } catch {
    // No user payload or raw event is logged; analytics must never block shopping.
    console.error("decision counter unavailable");
    return response(503);
  }
}
