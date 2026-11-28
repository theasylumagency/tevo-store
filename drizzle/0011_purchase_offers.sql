ALTER TABLE "purchase_requests" ADD COLUMN "offers" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD COLUMN "converted_order_id" uuid;
--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_converted_order_id_unique" UNIQUE("converted_order_id");
--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_converted_order_id_orders_id_fk" FOREIGN KEY ("converted_order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;
