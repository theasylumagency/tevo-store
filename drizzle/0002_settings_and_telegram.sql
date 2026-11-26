CREATE TABLE "store_settings" (
	"store_id" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_settings_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"data" jsonb NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_chats" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"chat_id" text NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_link_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "link" text;--> statement-breakpoint
CREATE INDEX "store_settings_history_store_idx" ON "store_settings_history" USING btree ("store_id","changed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_chats_store_chat_idx" ON "telegram_chats" USING btree ("store_id","chat_id");