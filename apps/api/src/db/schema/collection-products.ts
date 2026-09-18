import { index, pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";
import { collections } from "./collections";
import { products } from "./products";
import { stores } from "./stores";

export const collectionProducts = pgTable(
  "collection_products",
  {
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.collectionId, table.productId] }),
    index("collection_products_store_idx").on(table.storeId),
    index("collection_products_product_idx").on(table.productId),
  ],
);
