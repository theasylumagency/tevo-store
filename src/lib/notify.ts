import "server-only";
import type { Order } from "@/db/schema";

/**
 * Customer / staff notifications. Today: structured log line.
 * Notifications stage: SMS provider (customer) + e-mail / Telegram (staff) behind this same function.
 */
export type NotifyEvent = "order_created" | "payment_succeeded" | "payment_failed" | "status_changed";

export async function notify(event: NotifyEvent, order: Pick<Order, "number" | "status" | "customerPhone" | "total">) {
  console.info(JSON.stringify({ at: new Date().toISOString(), notify: event, order: order.number,
                                status: order.status, total: order.total }));
}
