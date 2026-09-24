import { index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./columns";
import { catalogItemSourceEnum } from "./enums";
import { orders } from "./orders";
import { stores } from "./stores";

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    /** STORE or GLOBAL product id snapshot reference (no FK — may be either table). */
    productId: uuid("product_id"),
    /** STORE or GLOBAL variant id snapshot reference (no FK — may be either table). */
    variantId: uuid("variant_id"),
    source: catalogItemSourceEnum("source").notNull().default("STORE"),
    productTitle: text("product_title").notNull(),
    variantTitle: text("variant_title").notNull(),
    sku: text("sku").notNull(),
    unitPricePaise: integer("unit_price_paise").notNull(),
    quantity: integer("quantity").notNull(),
    lineTotalPaise: integer("line_total_paise").notNull(),
    ...timestamps,
  },
  (table) => [
    index("order_items_store_id_idx").on(table.storeId, table.id),
    index("order_items_store_order_idx").on(table.storeId, table.orderId),
  ],
);
