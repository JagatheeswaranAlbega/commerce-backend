import { boolean, index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./columns";
import { customers } from "./customers";
import { stores } from "./stores";

export const customerAddresses = pgTable(
  "customer_addresses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone"),
    addressLine1: text("address_line_1").notNull(),
    addressLine2: text("address_line_2"),
    city: text("city").notNull(),
    state: text("state"),
    postalCode: text("postal_code").notNull(),
    country: text("country").notNull().default("IN"),
    isDefault: boolean("is_default").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    index("customer_addresses_store_id_idx").on(table.storeId, table.id),
    index("customer_addresses_store_customer_idx").on(table.storeId, table.customerId),
  ],
);
