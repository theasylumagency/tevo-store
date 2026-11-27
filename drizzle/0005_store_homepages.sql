CREATE TABLE "store_homepages" (
	"store_id" text PRIMARY KEY NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"draft" jsonb NOT NULL,
	"published" jsonb NOT NULL,
	"schedule" jsonb
);
