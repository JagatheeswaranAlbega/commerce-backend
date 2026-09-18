import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./columns";
import { customers } from "./customers";
import { orderReturnStatusEnum } from "./enums";
import { orders } from "./orders";
import { stores } from "./stores";

export const orderReturns = pgTable(
  "order_returns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    status: orderReturnStatusEnum("status").notNull().default("REQUESTED"),
    reason: text("reason").notNull(),
    decisionNote: text("decision_note"),
    decidedAt: timestamp("decided_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("order_returns_store_id_idx").on(table.storeId, table.id),
    index("order_returns_store_order_idx").on(table.storeId, table.orderId),
    index("order_returns_store_status_idx").on(table.storeId, table.status),
    // At most one open (REQUESTED) or completed (APPROVED) return per order.
    uniqueIndex("order_returns_store_order_active_unique")
      .on(table.storeId, table.orderId)
      .where(sql`${table.status} in ('REQUESTED', 'APPROVED')`),
  ],
);
