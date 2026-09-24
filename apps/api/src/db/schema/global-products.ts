import { index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./columns";
import { productStatusEnum } from "./enums";
import { globalCategories } from "./global-categories";

export const globalProducts = pgTable(
  "global_products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: uuid("category_id").references(() => globalCategories.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    handle: text("handle").notNull(),
    shortDescription: text("short_description"),
    description: text("description"),
    status: productStatusEnum("status").notNull().default("DRAFT"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("global_products_handle_unique").on(table.handle),
    index("global_products_status_idx").on(table.status),
    index("global_products_category_idx").on(table.categoryId),
    index("global_products_created_at_idx").on(table.createdAt),
  ],
);
