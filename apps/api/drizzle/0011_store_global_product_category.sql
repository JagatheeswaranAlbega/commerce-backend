ALTER TABLE "store_global_products" ADD COLUMN "store_category_id" uuid;--> statement-breakpoint
ALTER TABLE "store_global_products" ADD CONSTRAINT "store_global_products_store_category_id_categories_id_fk" FOREIGN KEY ("store_category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "store_global_products_store_category_idx" ON "store_global_products" USING btree ("store_id","store_category_id");
