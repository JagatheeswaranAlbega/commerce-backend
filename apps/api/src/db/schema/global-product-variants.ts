import { index, integer, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./columns";
import { variantStatusEnum } from "./enums";
import { globalProducts } from "./global-products";

export const globalProductVariants = pgTable(
  "global_product_variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => globalProducts.id, { onDelete: "cascade" }),
    sku: text("sku").notNull(),
    title: text("title").notNull(),
    pricePaise: integer("price_paise").notNull(),
    compareAtPricePaise: integer("compare_at_price_paise"),
    status: variantStatusEnum("status").notNull().default("DRAFT"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("global_product_variants_sku_unique").on(table.sku),
    index("global_product_variants_product_idx").on(table.productId),
    index("global_product_variants_status_idx").on(table.status),
  ],
);
