import { index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./columns";
import { storeStatusEnum } from "./enums";

export const stores = pgTable(
  "stores",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    status: storeStatusEnum("status").notNull().default("ACTIVE"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("stores_slug_unique").on(table.slug),
    index("stores_status_idx").on(table.status),
    index("stores_created_at_idx").on(table.createdAt),
  ],
);
