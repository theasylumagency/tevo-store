CREATE TABLE "catalog_edits" (
	"store_id" text NOT NULL,
	"product_id" text NOT NULL,
	"revision" integer NOT NULL,
	"draft" jsonb,
	"live" jsonb NOT NULL,
	CONSTRAINT "catalog_edits_store_id_product_id_pk" PRIMARY KEY("store_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "catalog_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"product_id" text,
	"edits" jsonb NOT NULL,
	"resolved" jsonb,
	"actor" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_catalogs" (
	"store_id" text PRIMARY KEY NOT NULL,
	"digest" text NOT NULL,
	"source" jsonb NOT NULL,
	"published" jsonb NOT NULL,
	"pricing" jsonb NOT NULL,
	"global_rule" jsonb,
	"policy_version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catalog_edits" ADD CONSTRAINT "catalog_edits_store_id_store_catalogs_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store_catalogs"("store_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_history" ADD CONSTRAINT "catalog_history_store_id_store_catalogs_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store_catalogs"("store_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catalog_history_product_idx" ON "catalog_history" USING btree ("store_id","product_id","id");