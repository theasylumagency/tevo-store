import "server-only";
import type { OnlineMethod, PaymentProvider } from "./types";

/** Built-in test bank: lets the whole order flow run end-to-end without bank credentials. */
export const mockProvider: PaymentProvider = {
  id: "mock",
  supports: () => true,
  async create(input) {
    return { redirectUrl: `/pay/mock/${input.paymentId}`, providerRef: `mock-${input.paymentId.slice(0, 8)}` };
  },
  async resolveCallback(req) {
    const body = (await req.json().catch(() => null)) as { paymentId?: string; outcome?: string } | null;
    if (!body?.paymentId || !["succeeded", "failed", "cancelled"].includes(body.outcome ?? "")) return null;
    return { paymentId: body.paymentId, outcome: body.outcome as "succeeded" | "failed" | "cancelled" };
  },
};

function credentials(prefix: string, storeId: string, keys: string[]) {
  const s = storeId.toUpperCase();
  const vals = keys.map((k) => process.env[`${prefix}_${k}_${s}`]);
  return vals.every(Boolean) ? vals as string[] : null;
}

/**
 * Bank of Georgia (online payments + installments). Each storefront has its own merchant,
 * so credentials are read per store: BOG_CLIENT_ID_<STORE>, BOG_CLIENT_SECRET_<STORE>.
 * TODO(payments stage): OAuth token → create order (card / installment) → redirect → callback → status check.
 */
export function bogProvider(storeId: string): PaymentProvider | null {
  if (!credentials("BOG", storeId, ["CLIENT_ID", "CLIENT_SECRET"])) return null;
  return {
    id: "bog",
    supports: (m: OnlineMethod) => m === "card" || m === "installment",
    async create() { throw new Error("BOG integration is not implemented yet"); },
    async resolveCallback() { throw new Error("BOG integration is not implemented yet"); },
  };
}

/** TBC (TPay + installments). Credentials per store: TBC_API_KEY_<STORE>, TBC_CLIENT_ID_<STORE>, TBC_CLIENT_SECRET_<STORE>. */
export function tbcProvider(storeId: string): PaymentProvider | null {
  if (!credentials("TBC", storeId, ["API_KEY", "CLIENT_ID", "CLIENT_SECRET"])) return null;
  return {
    id: "tbc",
    supports: (m: OnlineMethod) => m === "card" || m === "installment",
    async create() { throw new Error("TBC integration is not implemented yet"); },
    async resolveCallback() { throw new Error("TBC integration is not implemented yet"); },
  };
}

export const paymentsMode = () => (process.env.PAYMENTS_MODE === "live" ? "live" : "test");

/** Which provider handles a method for this store. Test mode always uses the mock bank. */
export function providerFor(method: OnlineMethod, storeId: string): PaymentProvider | null {
  if (paymentsMode() === "test") return mockProvider;
  const candidates = [bogProvider(storeId), tbcProvider(storeId)].filter(Boolean) as PaymentProvider[];
  return candidates.find((p) => p.supports(method)) ?? null;
}

export function providerById(id: string, storeId: string): PaymentProvider | null {
  if (id === "mock") return paymentsMode() === "test" ? mockProvider : null;
  if (id === "bog") return bogProvider(storeId);
  if (id === "tbc") return tbcProvider(storeId);
  return null;
}
