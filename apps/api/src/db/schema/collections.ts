import { index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./columns";
import { collectionStatusEnum } from "./enums";
import { stores } from "./stores";

export const collections = pgTable(
  "collections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    status: collectionStatusEnum("status").notNull().default("ACTIVE"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("collections_store_slug_unique").on(table.storeId, table.slug),
    index("collections_store_id_idx").on(table.storeId),
    index("collections_store_status_idx").on(table.storeId, table.status),
  ],
);
