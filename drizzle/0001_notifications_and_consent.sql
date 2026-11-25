CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" uuid,
	"event" text NOT NULL,
	"channel" text NOT NULL,
	"audience" text NOT NULL,
	"recipient" text NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"html" text,
	"status" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"provider" text,
	"provider_ref" text,
	"dedupe_key" text NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "notifications_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "short_code" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "terms_version" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "consented_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_due_idx" ON "notifications" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "notifications_order_idx" ON "notifications" USING btree ("order_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_short_code_unique" UNIQUE("short_code");