import { index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./columns";
import { categoryStatusEnum } from "./enums";

export const globalCategories = pgTable(
  "global_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    parentId: uuid("parent_id"),
    status: categoryStatusEnum("status").notNull().default("ACTIVE"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("global_categories_slug_unique").on(table.slug),
    index("global_categories_parent_idx").on(table.parentId),
    index("global_categories_status_idx").on(table.status),
  ],
);
