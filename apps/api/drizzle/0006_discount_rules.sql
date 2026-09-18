ALTER TABLE "discounts" ADD COLUMN "starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "discounts" ADD COLUMN "ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "discounts" ADD COLUMN "min_order_paise" integer;--> statement-breakpoint
ALTER TABLE "discounts" ADD COLUMN "usage_limit" integer;--> statement-breakpoint
ALTER TABLE "discounts" ADD COLUMN "usage_count" integer DEFAULT 0 NOT NULL;
