CREATE TYPE "public"."order_return_status" AS ENUM('REQUESTED', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "order_returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"customer_id" uuid,
	"status" "order_return_status" DEFAULT 'REQUESTED' NOT NULL,
	"reason" text NOT NULL,
	"decision_note" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_returns" ADD CONSTRAINT "order_returns_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_returns" ADD CONSTRAINT "order_returns_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_returns" ADD CONSTRAINT "order_returns_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_returns_store_id_idx" ON "order_returns" USING btree ("store_id","id");--> statement-breakpoint
CREATE INDEX "order_returns_store_order_idx" ON "order_returns" USING btree ("store_id","order_id");--> statement-breakpoint
CREATE INDEX "order_returns_store_status_idx" ON "order_returns" USING btree ("store_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "order_returns_store_order_active_unique" ON "order_returns" USING btree ("store_id","order_id") WHERE "order_returns"."status" in ('REQUESTED', 'APPROVED');
