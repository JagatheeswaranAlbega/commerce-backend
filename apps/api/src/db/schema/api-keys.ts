import { index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./columns";
import { apiKeyStatusEnum, apiKeyTypeEnum } from "./enums";
import { stores } from "./stores";

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    type: apiKeyTypeEnum("type").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    secretHash: text("secret_hash").notNull(),
    status: apiKeyStatusEnum("status").notNull().default("ACTIVE"),
    ...timestamps,
  },
  (table) => [
    index("api_keys_store_id_idx").on(table.storeId),
    index("api_keys_store_type_idx").on(table.storeId, table.type),
    index("api_keys_prefix_idx").on(table.keyPrefix),
    uniqueIndex("api_keys_secret_hash_unique").on(table.secretHash),
  ],
);
