import { index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./columns";
import { stores } from "./stores";

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    passwordHash: text("password_hash"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("customers_store_email_unique").on(table.storeId, table.email),
    index("customers_store_id_idx").on(table.storeId, table.id),
  ],
);
