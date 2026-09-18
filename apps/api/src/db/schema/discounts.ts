import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./columns";
import { discountStatusEnum, discountTypeEnum } from "./enums";
import { stores } from "./stores";

export const discounts = pgTable(
  "discounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    type: discountTypeEnum("type").notNull(),
    value: integer("value").notNull(),
    status: discountStatusEnum("status").notNull().default("ACTIVE"),
    startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }),
    endsAt: timestamp("ends_at", { withTimezone: true, mode: "date" }),
    minOrderPaise: integer("min_order_paise"),
    usageLimit: integer("usage_limit"),
    usageCount: integer("usage_count").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("discounts_store_code_unique").on(table.storeId, table.code),
    index("discounts_store_id_idx").on(table.storeId, table.id),
    index("discounts_store_status_idx").on(table.storeId, table.status),
  ],
);
