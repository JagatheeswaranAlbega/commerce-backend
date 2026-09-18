import { index, integer, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./columns";
import { variantStatusEnum } from "./enums";
import { products } from "./products";
import { stores } from "./stores";

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: text("sku").notNull(),
    title: text("title").notNull(),
    pricePaise: integer("price_paise").notNull(),
    compareAtPricePaise: integer("compare_at_price_paise"),
    status: variantStatusEnum("status").notNull().default("DRAFT"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("product_variants_store_sku_unique").on(table.storeId, table.sku),
    index("product_variants_store_id_idx").on(table.storeId, table.id),
    index("product_variants_store_product_idx").on(table.storeId, table.productId),
    index("product_variants_store_status_idx").on(table.storeId, table.status),
  ],
);
