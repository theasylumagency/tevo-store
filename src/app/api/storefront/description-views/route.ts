import { z } from "zod";
import { countDescriptionExposure, countDescriptionOpening } from "@/lib/voice/description-counts";

export async function POST(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin");
  const expectedOrigin = new URL(process.env.PUBLIC_BASE_URL || request.url).origin;
  if ((site && site !== "same-origin") || (origin && origin !== expectedOrigin) || (!origin && !site)) {
    return new Response(null, { status: 403 });
  }
  if (request.headers.get("dnt") === "1" || request.headers.get("sec-gpc") === "1") return new Response(null, { status: 204 });
  const event = request.headers.get("x-description-event");
  if (event === "open") {
    return new Response(await countDescriptionOpening(), { headers: { "Cache-Control": "no-store" } });
  }
  const day = z.iso.date().safeParse(request.headers.get("x-description-day"));
  if (event !== "exposed" || !day.success) return new Response(null, { status: 400 });
  await countDescriptionExposure(day.data);
  return new Response(null, { status: 204 });
}
