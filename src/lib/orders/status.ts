/** Order lifecycle. Payment state is tracked separately (paymentStatus). */
export const ORDER_STATUSES = [
  "pending_payment", "new", "confirmed", "ready_for_pickup", "shipped", "completed", "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ["unpaid", "pending", "paid", "failed", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** What an admin may move an order to from each status. */
export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["new", "cancelled"],          // "new" = customer will pay another way (agreed by phone)
  new: ["confirmed", "cancelled"],
  confirmed: ["ready_for_pickup", "shipped", "cancelled"],
  ready_for_pickup: ["completed", "cancelled"],
  shipped: ["completed"],
  completed: [],
  cancelled: [],
};

export function canTransition(from: string, to: string) {
  return (TRANSITIONS[from as OrderStatus] ?? []).includes(to as OrderStatus);
}

export const isOpen = (s: string) => s !== "completed" && s !== "cancelled";
