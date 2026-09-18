import { index, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./columns";
import { stores } from "./stores";

export const storeSettings = pgTable(
  "store_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("store_settings_store_key_unique").on(table.storeId, table.key),
    index("store_settings_store_id_idx").on(table.storeId),
  ],
);
