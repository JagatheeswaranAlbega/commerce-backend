ALTER TABLE "orders" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "admin_note" text;--> statement-breakpoint
CREATE INDEX "orders_store_email_idx" ON "orders" USING btree ("store_id","email");
