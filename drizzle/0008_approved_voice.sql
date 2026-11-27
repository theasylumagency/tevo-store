ALTER TABLE "voice_items" ADD COLUMN "group_no" integer;--> statement-breakpoint
ALTER TABLE "voice_profiles" ADD COLUMN "active_run_id" uuid;--> statement-breakpoint
ALTER TABLE "voice_runs" ADD COLUMN "policy" text;--> statement-breakpoint
ALTER TABLE "voice_runs" ADD COLUMN "basis_id" uuid;--> statement-breakpoint
ALTER TABLE "voice_runs" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "voice_runs" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "voice_runs" ADD COLUMN "notify_email" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "voice_runs" ADD COLUMN "examples" jsonb;