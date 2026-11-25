import "server-only";
import { after } from "next/server";
import type { Order } from "@/db/schema";
import { dispatch, enqueue } from "@/lib/messaging/outbox";
import type { MessageEvent } from "@/lib/messaging/templates";

export type NotifyEvent = MessageEvent;

/**
 * Queue the messages for an order event, then send them after the response has gone out,
 * so a slow SMS gateway never slows down checkout. Anything that fails is retried by /api/cron/notifications.
 * Never throws: a notification problem must not break an order.
 */
export async function notify(event: NotifyEvent, order: Order) {
  try {
    const ids = await enqueue(event, order);
    if (!ids.length) return;
    const run = () => dispatch(ids).catch((e) => console.error("notification dispatch failed", e));
    try { after(run); } catch { void run(); }   // outside a request (scripts, tests): send now
  } catch (e) {
    console.error("notification enqueue failed", event, order.number, e);
  }
}
