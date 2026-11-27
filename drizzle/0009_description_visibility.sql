CREATE TABLE "description_counts" (
	"store_id" text NOT NULL,
	"review" boolean NOT NULL,
	"day" date NOT NULL,
	"openings" integer DEFAULT 0 NOT NULL,
	"exposures" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "description_counts_store_id_review_day_pk" PRIMARY KEY("store_id","review","day")
);
