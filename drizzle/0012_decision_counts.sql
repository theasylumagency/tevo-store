CREATE TABLE "decision_counts" (
  "store_id" text NOT NULL,
  "review" boolean NOT NULL,
  "day" date NOT NULL,
  "event" text NOT NULL,
  "count" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "decision_counts_store_id_review_day_event_pk" PRIMARY KEY("store_id","review","day","event")
);
