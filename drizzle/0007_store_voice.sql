CREATE TABLE "voice_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"product_id" text NOT NULL,
	"name" text NOT NULL,
	"facts" jsonb NOT NULL,
	"digest" text NOT NULL,
	"edit_revision" integer NOT NULL,
	"original" text NOT NULL,
	"paragraphs" jsonb,
	"proposal" text,
	"flags" jsonb NOT NULL,
	"status" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"lease" timestamp with time zone,
	"error" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "voice_profiles" (
	"store_id" text PRIMARY KEY NOT NULL,
	"revision" integer NOT NULL,
	"profile" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"scope" text NOT NULL,
	"profile_version" integer NOT NULL,
	"profile" jsonb NOT NULL,
	"model" text NOT NULL,
	"source_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catalog_edits" ADD COLUMN "voice_item_id" integer;--> statement-breakpoint
ALTER TABLE "voice_items" ADD CONSTRAINT "voice_items_run_id_voice_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."voice_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_runs" ADD CONSTRAINT "voice_runs_store_id_store_catalogs_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store_catalogs"("store_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "voice_items_run_sku_idx" ON "voice_items" USING btree ("run_id","product_id");--> statement-breakpoint
CREATE INDEX "voice_items_queue_idx" ON "voice_items" USING btree ("status","id");--> statement-breakpoint
CREATE INDEX "voice_runs_store_idx" ON "voice_runs" USING btree ("store_id","created_at");