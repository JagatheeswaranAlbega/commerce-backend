import { index, integer, pgTable, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./columns";
import { productVariants } from "./product-variants";
import { stores } from "./stores";

export const inventory = pgTable(
  "inventory",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    availableQuantity: integer("available_quantity").notNull().default(0),
    reservedQuantity: integer("reserved_quantity").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("inventory_store_variant_unique").on(table.storeId, table.variantId),
    index("inventory_store_id_idx").on(table.storeId, table.id),
    index("inventory_variant_idx").on(table.variantId),
  ],
);
