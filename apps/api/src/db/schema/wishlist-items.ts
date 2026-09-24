import { index, pgTable, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./columns";
import { customers } from "./customers";
import { catalogItemSourceEnum } from "./enums";
import { stores } from "./stores";

export const wishlistItems = pgTable(
  "wishlist_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    /** STORE or GLOBAL variant id; validated by sellable-variant resolver. */
    variantId: uuid("variant_id").notNull(),
    source: catalogItemSourceEnum("source").notNull().default("STORE"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("wishlist_items_store_customer_variant_unique").on(
      table.storeId,
      table.customerId,
      table.variantId,
    ),
    index("wishlist_items_store_id_idx").on(table.storeId, table.id),
    index("wishlist_items_store_customer_idx").on(table.storeId, table.customerId),
  ],
);
