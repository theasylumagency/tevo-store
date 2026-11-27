import "server-only";
import { and, desc, eq, gte, inArray, sql, sum } from "drizzle-orm";
import { getDb } from "@/db";
import { orderEvents, orderItems, orders } from "@/db/schema";
import { getStore } from "@/config/store";

export async function confirmedSales() {
  const db = await getDb();
  const confirmed = db.selectDistinct({ id: orderEvents.orderId }).from(orderEvents).where(and(
    eq(orderEvents.type, "status"), eq(orderEvents.toStatus, "confirmed"),
    gte(orderEvents.createdAt, sql`current_timestamp - interval '30 days'`),
  ));
  const quantity = sum(orderItems.quantity);
  const rows = await db.select({ id: orderItems.productId }).from(orderItems).innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(eq(orders.storeId, getStore().id), inArray(orders.id, confirmed),
      inArray(orders.status, ["confirmed", "ready_for_pickup", "shipped", "completed"]), eq(orders.paymentStatus, "paid")))
    .groupBy(orderItems.productId).orderBy(desc(quantity), orderItems.productId);
  return rows.map(row => row.id);
}
