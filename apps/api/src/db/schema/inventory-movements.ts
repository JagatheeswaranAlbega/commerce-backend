import { index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./columns";
import { inventoryMovementTypeEnum } from "./enums";
import { productVariants } from "./product-variants";
import { stores } from "./stores";

export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    type: inventoryMovementTypeEnum("type").notNull(),
    quantity: integer("quantity").notNull(),
    reference: text("reference"),
    ...timestamps,
  },
  (table) => [
    index("inventory_movements_store_id_idx").on(table.storeId, table.id),
    index("inventory_movements_store_variant_idx").on(table.storeId, table.variantId),
    index("inventory_movements_created_at_idx").on(table.storeId, table.createdAt),
  ],
);
