export type OnlineMethod = "card" | "installment";

export interface CreatePaymentInput {
  paymentId: string;        // our payments.id — used as the bank's external order id
  orderNumber: string;
  amount: number;           // tetri
  currency: "GEL";
  method: OnlineMethod;
  storeId: string;
  returnUrl: string;        // where the bank sends the customer back
  callbackUrl: string;      // server-to-server notification
  items: { name: string; qty: number; unitPrice: number; productId: string }[];
}

export interface CreatePaymentResult {
  redirectUrl: string;
  providerRef: string | null;
  raw?: unknown;
}

export type PaymentOutcome = "succeeded" | "failed" | "cancelled" | "pending";

export interface PaymentProvider {
  id: "mock" | "bog" | "tbc";
  supports(method: OnlineMethod): boolean;
  create(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  /**
   * Turn a bank callback into an outcome. Real providers must NOT trust the callback body:
   * they re-fetch the payment status from the bank API by providerRef before answering.
   */
  resolveCallback(req: Request): Promise<{ paymentId: string; outcome: PaymentOutcome; raw?: unknown } | null>;
}
