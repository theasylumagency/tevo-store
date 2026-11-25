import { redirect } from "next/navigation";
import { resolveShortCode } from "@/lib/orders/service";

/** Short order links from SMS: /o/Ab3dE9xQ → /order/S-100001?t=… */
export async function GET(_req: Request, ctx: RouteContext<"/o/[code]">) {
  const { code } = await ctx.params;
  const url = await resolveShortCode(code);
  if (!url) return new Response("Not found", { status: 404 });
  redirect(url);
}
