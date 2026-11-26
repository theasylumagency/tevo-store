import { timingSafeEqual } from "node:crypto";
import { handleUpdate } from "@/lib/telegram";

/** Telegram → us. Authenticated by the secret_token we passed to setWebhook (X-Telegram-Bot-Api-Secret-Token). */
export async function POST(req: Request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  const got = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  const a = Buffer.from(got), b = Buffer.from(expected);
  if (expected.length < 16 || a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    await handleUpdate(await req.json());
  } catch (e) {
    console.error("telegram update failed", e);   // still 200: a retry storm from Telegram would not help
  }
  return Response.json({ ok: true });
}
