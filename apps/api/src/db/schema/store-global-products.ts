import { index, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./columns";
import { categories } from "./categories";
import { categoryStatusEnum } from "./enums";
import { globalProducts } from "./global-products";
import { stores } from "./stores";

export const storeGlobalProducts = pgTable(
  "store_global_products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    globalProductId: uuid("global_product_id")
      .notNull()
      .references(() => globalProducts.id, { onDelete: "cascade" }),
    storeCategoryId: uuid("store_category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    status: categoryStatusEnum("status").notNull().default("ACTIVE"),
    importedAt: timestamp("imported_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("store_global_products_store_product_unique").on(
      table.storeId,
      table.globalProductId,
    ),
    index("store_global_products_store_id_idx").on(table.storeId, table.id),
    index("store_global_products_store_status_idx").on(table.storeId, table.status),
    index("store_global_products_product_idx").on(table.globalProductId),
    index("store_global_products_store_category_idx").on(table.storeId, table.storeCategoryId),
  ],
);
