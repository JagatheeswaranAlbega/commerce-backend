import { index, integer, pgTable, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { carts } from "./carts";
import { timestamps } from "./columns";
import { productVariants } from "./product-variants";
import { stores } from "./stores";

export const cartLineItems = pgTable(
  "cart_line_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    unitPricePaise: integer("unit_price_paise").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("cart_line_items_cart_variant_unique").on(table.cartId, table.variantId),
    index("cart_line_items_store_id_idx").on(table.storeId, table.id),
    index("cart_line_items_store_cart_idx").on(table.storeId, table.cartId),
  ],
);
