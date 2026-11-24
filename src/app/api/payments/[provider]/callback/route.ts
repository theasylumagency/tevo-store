import { handleProviderCallback } from "@/lib/orders/service";

/** Server-to-server notifications from the bank. The provider re-verifies the status before we trust it. */
export async function POST(req: Request, ctx: RouteContext<"/api/payments/[provider]/callback">) {
  const { provider } = await ctx.params;
  try {
    const res = await handleProviderCallback(provider, req);
    return Response.json({ ok: res.ok }, { status: res.status });
  } catch (e) {
    console.error("payment callback failed", provider, e);
    return Response.json({ ok: false }, { status: 500 });
  }
}
