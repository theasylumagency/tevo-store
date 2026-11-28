CREATE TABLE "purchase_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" text NOT NULL,
  "token_hash" text NOT NULL,
  "status" text DEFAULT 'new' NOT NULL,
  "revision" integer DEFAULT 0 NOT NULL,
  "customer_name" text NOT NULL,
  "customer_phone" text NOT NULL,
  "delivery_method" text NOT NULL,
  "locality" text,
  "question" text,
  "lines" jsonb NOT NULL,
  "catalog_version" text NOT NULL,
  "response" text,
  "history" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_requests_store_token_idx" ON "purchase_requests" USING btree ("store_id","token_hash");
--> statement-breakpoint
CREATE INDEX "purchase_requests_store_created_idx" ON "purchase_requests" USING btree ("store_id","created_at");
