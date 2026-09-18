import { boolean, index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./columns";
import { products } from "./products";
import { stores } from "./stores";

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    url: text("url"),
    altText: text("alt_text"),
    sortOrder: integer("sort_order").notNull().default(0),
    /** Explicit storefront main image; at most one per product (enforced in MediaService). */
    isThumbnail: boolean("is_thumbnail").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    index("product_images_store_id_idx").on(table.storeId, table.id),
    index("product_images_store_product_idx").on(table.storeId, table.productId),
  ],
);
