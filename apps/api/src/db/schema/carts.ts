import { index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./columns";
import { customers } from "./customers";
import { cartStatusEnum } from "./enums";
import { stores } from "./stores";

export const carts = pgTable(
  "carts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    email: text("email"),
    status: cartStatusEnum("status").notNull().default("ACTIVE"),
    shippingName: text("shipping_name"),
    shippingPhone: text("shipping_phone"),
    shippingAddressLine1: text("shipping_address_line_1"),
    shippingAddressLine2: text("shipping_address_line_2"),
    shippingCity: text("shipping_city"),
    shippingState: text("shipping_state"),
    shippingPostalCode: text("shipping_postal_code"),
    shippingCountry: text("shipping_country"),
    subtotalPaise: integer("subtotal_paise").notNull().default(0),
    discountCode: text("discount_code"),
    discountTotalPaise: integer("discount_total_paise").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    index("carts_store_id_idx").on(table.storeId, table.id),
    index("carts_store_customer_idx").on(table.storeId, table.customerId),
    index("carts_store_status_idx").on(table.storeId, table.status),
  ],
);
