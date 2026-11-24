import { index, integer, jsonb, pgTable, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Money is stored as integer tetri (1 ₾ = 100) — never floats. */

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  seq: serial("seq").notNull().unique(),
  number: text("number").unique(),
  storeId: text("store_id").notNull(),
  status: text("status").notNull(),                 // see lib/orders/status.ts
  paymentMethod: text("payment_method").notNull(),  // card | installment | cash
  paymentStatus: text("payment_status").notNull(),  // unpaid | pending | paid | failed | refunded
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerEmail: text("customer_email"),
  deliveryMethod: text("delivery_method").notNull(), // pickup | delivery
  region: text("region"),
  city: text("city"),
  address: text("address"),
  comment: text("comment"),
  subtotal: integer("subtotal").notNull(),
  deliveryFee: integer("delivery_fee"),               // null = confirmed by phone
  total: integer("total").notNull(),
  currency: text("currency").notNull().default("GEL"),
  accessToken: text("access_token").notNull(),
  catalogVersion: text("catalog_version"),
  khidiSyncedAt: timestamp("khidi_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("orders_store_created_idx").on(t.storeId, t.createdAt), index("orders_status_idx").on(t.status)]);

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  model: text("model"),
  brand: text("brand"),
  unitPrice: integer("unit_price").notNull(),
  quantity: integer("quantity").notNull(),
  lineTotal: integer("line_total").notNull(),
}, (t) => [index("order_items_order_idx").on(t.orderId)]);

export const orderEvents = pgTable("order_events", {
  id: serial("id").primaryKey(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  type: text("type").notNull(),            // created | status | payment | note
  fromStatus: text("from_status"),
  toStatus: text("to_status"),
  note: text("note"),
  actor: text("actor").notNull(),          // customer | admin | payment | system
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("order_events_order_idx").on(t.orderId)]);

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),    // mock | bog | tbc
  method: text("method").notNull(),        // card | installment
  status: text("status").notNull(),        // created | pending | succeeded | failed | cancelled
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("GEL"),
  providerRef: text("provider_ref"),
  redirectUrl: text("redirect_url"),
  raw: jsonb("raw"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("payments_order_idx").on(t.orderId), index("payments_ref_idx").on(t.provider, t.providerRef)]);

export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type OrderEvent = typeof orderEvents.$inferSelect;
export type Payment = typeof payments.$inferSelect;
