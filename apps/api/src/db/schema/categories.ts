import { index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./columns";
import { categoryStatusEnum } from "./enums";
import { stores } from "./stores";

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    parentId: uuid("parent_id"),
    status: categoryStatusEnum("status").notNull().default("ACTIVE"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("categories_store_slug_unique").on(table.storeId, table.slug),
    index("categories_store_id_idx").on(table.storeId),
    index("categories_store_parent_idx").on(table.storeId, table.parentId),
    index("categories_store_status_idx").on(table.storeId, table.status),
  ],
);
