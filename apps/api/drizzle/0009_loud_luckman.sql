CREATE TYPE "public"."catalog_item_source" AS ENUM('STORE', 'GLOBAL');--> statement-breakpoint
CREATE TABLE "global_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"parent_id" uuid,
	"status" "category_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "global_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid,
	"title" text NOT NULL,
	"handle" text NOT NULL,
	"short_description" text,
	"description" text,
	"status" "product_status" DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "global_product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"title" text NOT NULL,
	"price_paise" integer NOT NULL,
	"compare_at_price_paise" integer,
	"status" "variant_status" DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "global_product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"url" text,
	"alt_text" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_thumbnail" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_global_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"global_product_id" uuid NOT NULL,
	"status" "category_status" DEFAULT 'ACTIVE' NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cart_line_items" DROP CONSTRAINT IF EXISTS "cart_line_items_variant_id_product_variants_id_fk";
--> statement-breakpoint
ALTER TABLE "inventory" DROP CONSTRAINT IF EXISTS "inventory_variant_id_product_variants_id_fk";
--> statement-breakpoint
ALTER TABLE "inventory_movements" DROP CONSTRAINT IF EXISTS "inventory_movements_variant_id_product_variants_id_fk";
--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS "order_items_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS "order_items_variant_id_product_variants_id_fk";
--> statement-breakpoint
ALTER TABLE "wishlist_items" DROP CONSTRAINT IF EXISTS "wishlist_items_variant_id_product_variants_id_fk";
--> statement-breakpoint
ALTER TABLE "cart_line_items" ADD COLUMN "source" "catalog_item_source" DEFAULT 'STORE' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "source" "catalog_item_source" DEFAULT 'STORE' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD COLUMN "source" "catalog_item_source" DEFAULT 'STORE' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "source" "catalog_item_source" DEFAULT 'STORE' NOT NULL;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD COLUMN "source" "catalog_item_source" DEFAULT 'STORE' NOT NULL;--> statement-breakpoint
ALTER TABLE "global_product_images" ADD CONSTRAINT "global_product_images_product_id_global_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."global_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "global_product_variants" ADD CONSTRAINT "global_product_variants_product_id_global_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."global_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "global_products" ADD CONSTRAINT "global_products_category_id_global_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."global_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_global_products" ADD CONSTRAINT "store_global_products_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_global_products" ADD CONSTRAINT "store_global_products_global_product_id_global_products_id_fk" FOREIGN KEY ("global_product_id") REFERENCES "public"."global_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "global_categories_slug_unique" ON "global_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "global_categories_parent_idx" ON "global_categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "global_categories_status_idx" ON "global_categories" USING btree ("status");--> statement-breakpoint
CREATE INDEX "global_product_images_product_idx" ON "global_product_images" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "global_product_variants_sku_unique" ON "global_product_variants" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "global_product_variants_product_idx" ON "global_product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "global_product_variants_status_idx" ON "global_product_variants" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "global_products_handle_unique" ON "global_products" USING btree ("handle");--> statement-breakpoint
CREATE INDEX "global_products_status_idx" ON "global_products" USING btree ("status");--> statement-breakpoint
CREATE INDEX "global_products_category_idx" ON "global_products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "global_products_created_at_idx" ON "global_products" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "store_global_products_store_product_unique" ON "store_global_products" USING btree ("store_id","global_product_id");--> statement-breakpoint
CREATE INDEX "store_global_products_store_id_idx" ON "store_global_products" USING btree ("store_id","id");--> statement-breakpoint
CREATE INDEX "store_global_products_store_status_idx" ON "store_global_products" USING btree ("store_id","status");--> statement-breakpoint
CREATE INDEX "store_global_products_product_idx" ON "store_global_products" USING btree ("global_product_id");--> statement-breakpoint
CREATE INDEX "inventory_store_source_idx" ON "inventory" USING btree ("store_id","source");
