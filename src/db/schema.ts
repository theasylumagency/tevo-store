import type { Evidence, Paragraph, Scope, VoiceProfile, VoiceStatus } from "../lib/voice/model";
import type { HomeDocument, HomeSchedule } from "../lib/homepage/model";
import type { Catalog, Product } from "../lib/catalog/types";
import type { PriceOrigin, PriceRule, ProductEdits } from "../lib/catalog/publication";
import { boolean, index, integer, jsonb, pgTable, primaryKey, serial, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

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
  shortCode: text("short_code").unique(),           // for SMS links: /o/<code>
  termsVersion: text("terms_version"),              // which terms the customer accepted
  consentedAt: timestamp("consented_at", { withTimezone: true }),
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

/** Outbox of customer / staff messages: queued first, then sent and retried independently of the order flow. */
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  channel: text("channel").notNull(),          // sms | email | telegram
  audience: text("audience").notNull(),        // customer | staff
  recipient: text("recipient").notNull(),
  subject: text("subject"),
  body: text("body").notNull(),
  html: text("html"),
  link: text("link"),                          // telegram: "open in admin" button
  status: text("status").notNull(),            // queued | sent | failed | skipped
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  provider: text("provider"),
  providerRef: text("provider_ref"),
  dedupeKey: text("dedupe_key").notNull().unique(),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
}, (t) => [index("notifications_due_idx").on(t.status, t.nextAttemptAt), index("notifications_order_idx").on(t.orderId)]);

/** Per-store details editable in the admin (seller, contacts, staff notifications). One row per store. */
export const storeSettings = pgTable("store_settings", {
  storeId: text("store_id").primaryKey(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Every saved version — legal pages quote the seller's details, so changes must be traceable. */
export const storeSettingsHistory = pgTable("store_settings_history", {
  id: serial("id").primaryKey(),
  storeId: text("store_id").notNull(),
  data: jsonb("data").notNull(),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("store_settings_history_store_idx").on(t.storeId, t.changedAt)]);

/** Telegram chats (people or groups) that receive staff notifications. */
export const telegramChats = pgTable("telegram_chats", {
  id: serial("id").primaryKey(),
  storeId: text("store_id").notNull(),
  chatId: text("chat_id").notNull(),
  title: text("title").notNull(),
  kind: text("kind").notNull(),                 // private | group | supergroup
  active: boolean("active").notNull().default(true),
  linkedAt: timestamp("linked_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("telegram_chats_store_chat_idx").on(t.storeId, t.chatId)]);

/** One-time codes behind the "connect Telegram" link in the admin (t.me/<bot>?start=<code>). */
export const telegramLinkCodes = pgTable("telegram_link_codes", {
  code: text("code").primaryKey(),
  storeId: text("store_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

export type TelegramChat = typeof telegramChats.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type OrderEvent = typeof orderEvents.$inferSelect;
export type Payment = typeof payments.$inferSelect;

/** Upstream input, pricing provenance and the already-prepared public read model. */
export const storeCatalogs = pgTable("store_catalogs", {
  storeId: text("store_id").primaryKey(),
  digest: text("digest").notNull(),
  source: jsonb("source").$type<Catalog>().notNull(),
  published: jsonb("published").$type<Catalog>().notNull(),
  pricing: jsonb("pricing").$type<Record<string, PriceOrigin>>().notNull(),
  globalRule: jsonb("global_rule").$type<PriceRule>(),
  policyVersion: integer("policy_version").notNull().default(1),
});

export const catalogEdits = pgTable("catalog_edits", {
  storeId: text("store_id").notNull().references(() => storeCatalogs.storeId),
  productId: text("product_id").notNull(),
  revision: integer("revision").notNull(),
  draft: jsonb("draft").$type<ProductEdits>(),
  voiceItemId: integer("voice_item_id"), // Present only while the live description is unmodified AI copy.
  live: jsonb("live").$type<ProductEdits>().notNull(),
}, t => [primaryKey({ columns: [t.storeId, t.productId] })]);

export const catalogHistory = pgTable("catalog_history", {
  id: serial("id").primaryKey(),
  storeId: text("store_id").notNull().references(() => storeCatalogs.storeId),
  productId: text("product_id"), // null = store-wide pricing
  edits: jsonb("edits").$type<ProductEdits>().notNull(),
  resolved: jsonb("resolved").$type<Pick<Product, "name" | "subtitle" | "description" | "features" | "price">>(),
  actor: text("actor").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("catalog_history_product_idx").on(t.storeId, t.productId, t.id)]);

/** Published price transitions, including source imports and store-wide changes. */
export const priceHistory = pgTable("price_history", {
  id: serial("id").primaryKey(),
  storeId: text("store_id").notNull().references(() => storeCatalogs.storeId),
  productId: text("product_id").notNull(),
  name: text("name").notNull(),
  reason: text("reason").$type<"import" | "product" | "global">().notNull(),
  before: jsonb("before").$type<Product["price"]>(),
  after: jsonb("after").$type<Product["price"]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("price_history_store_idx").on(t.storeId, t.id),
  index("price_history_product_idx").on(t.storeId, t.productId, t.id)]);

/** A scheduled release owns its snapshot independently of subsequent draft edits. */
export const storeHomepages = pgTable("store_homepages", {
  storeId: text("store_id").primaryKey(),
  revision: integer("revision").notNull().default(0),
  draft: jsonb("draft").$type<HomeDocument>().notNull(),
  published: jsonb("published").$type<HomeDocument>().notNull(),
  schedule: jsonb("schedule").$type<HomeSchedule>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
});

/** Content snapshots only: restoring a page never restores catalog prices or availability. */
export const homepageHistory = pgTable("homepage_history", {
  id: serial("id").primaryKey(),
  storeId: text("store_id").notNull().references(() => storeHomepages.storeId),
  revision: integer("revision").notNull(),
  kind: text("kind").notNull(),
  actor: text("actor").notNull(),
  document: jsonb("document").$type<HomeDocument>().notNull(),
  summary: jsonb("summary").$type<string[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("homepage_history_store_idx").on(t.storeId, t.id)]);

export const voiceProfiles = pgTable("voice_profiles", {
  storeId: text("store_id").primaryKey(),
  revision: integer("revision").notNull(),
  profile: jsonb("profile").$type<VoiceProfile>().notNull(),
});

export const voiceRuns = pgTable("voice_runs", {
  id: uuid("id").primaryKey(),
  storeId: text("store_id").notNull().references(() => storeCatalogs.storeId),
  scope: text("scope").$type<Scope>().notNull(),
  profileVersion: integer("profile_version").notNull(),
  profile: jsonb("profile").$type<VoiceProfile>().notNull(),
  model: text("model").notNull(),
  sourceVersion: text("source_version").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [index("voice_runs_store_idx").on(t.storeId, t.createdAt)]);

export const voiceItems = pgTable("voice_items", {
  id: serial("id").primaryKey(),
  runId: uuid("run_id").notNull().references(() => voiceRuns.id),
  productId: text("product_id").notNull(),
  name: text("name").notNull(),
  facts: jsonb("facts").$type<Evidence[]>().notNull(),
  digest: text("digest").notNull(),
  editRevision: integer("edit_revision").notNull(),
  original: text("original").notNull(),
  paragraphs: jsonb("paragraphs").$type<Paragraph[]>(),
  proposal: text("proposal"),
  flags: jsonb("flags").$type<string[]>().notNull(),
  status: text("status").$type<VoiceStatus>().notNull(),
  revision: integer("revision").notNull().default(0),
  lease: timestamp("lease", { withTimezone: true }),
  error: text("error"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
}, t => [uniqueIndex("voice_items_run_sku_idx").on(t.runId, t.productId), index("voice_items_queue_idx").on(t.status, t.id)]);
