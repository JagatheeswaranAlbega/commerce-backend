import { index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { categories } from "./categories";
import { timestamps } from "./columns";
import { productStatusEnum } from "./enums";
import { stores } from "./stores";

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    handle: text("handle").notNull(),
    shortDescription: text("short_description"),
    description: text("description"),
    status: productStatusEnum("status").notNull().default("DRAFT"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("products_store_handle_unique").on(table.storeId, table.handle),
    index("products_store_id_idx").on(table.storeId, table.id),
    index("products_store_status_idx").on(table.storeId, table.status),
    index("products_store_category_idx").on(table.storeId, table.categoryId),
    index("products_store_created_at_idx").on(table.storeId, table.createdAt),
  ],
);
