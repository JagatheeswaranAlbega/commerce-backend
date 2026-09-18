ALTER TABLE "carts" ADD COLUMN "discount_code" text;--> statement-breakpoint
ALTER TABLE "carts" ADD COLUMN "discount_total_paise" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_code" text;
