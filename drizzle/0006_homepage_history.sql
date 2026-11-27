CREATE TABLE "homepage_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"revision" integer NOT NULL,
	"kind" text NOT NULL,
	"actor" text NOT NULL,
	"document" jsonb NOT NULL,
	"summary" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "store_homepages" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "store_homepages" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "homepage_history" ADD CONSTRAINT "homepage_history_store_id_store_homepages_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store_homepages"("store_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "homepage_history_store_idx" ON "homepage_history" USING btree ("store_id","id");