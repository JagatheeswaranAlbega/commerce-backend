import { boolean, index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./columns";
import { globalProducts } from "./global-products";

export const globalProductImages = pgTable(
  "global_product_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => globalProducts.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    url: text("url"),
    altText: text("alt_text"),
    sortOrder: integer("sort_order").notNull().default(0),
    isThumbnail: boolean("is_thumbnail").notNull().default(false),
    ...timestamps,
  },
  (table) => [index("global_product_images_product_idx").on(table.productId)],
);
