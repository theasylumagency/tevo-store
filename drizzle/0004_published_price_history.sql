CREATE TABLE "price_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"product_id" text NOT NULL,
	"name" text NOT NULL,
	"reason" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_store_id_store_catalogs_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store_catalogs"("store_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "price_history_store_idx" ON "price_history" USING btree ("store_id","id");--> statement-breakpoint
CREATE INDEX "price_history_product_idx" ON "price_history" USING btree ("store_id","product_id","id");