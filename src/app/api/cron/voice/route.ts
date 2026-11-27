import { hasBearer } from "@/lib/auth/bearer";
import { processVoiceQueue } from "@/lib/voice/worker";

export async function POST(req: Request) {
  if (!hasBearer(req, "CRON_TOKEN")) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json(await processVoiceQueue());
}
