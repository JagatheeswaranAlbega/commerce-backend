import { sql } from "drizzle-orm";
import { index, integer, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./columns";
import { customers } from "./customers";
import { orderStatusEnum } from "./enums";
import { stores } from "./stores";

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    orderNumber: text("order_number").notNull(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    email: text("email"),
    status: orderStatusEnum("status").notNull().default("PENDING"),
    idempotencyKey: text("idempotency_key"),
    subtotalPaise: integer("subtotal_paise").notNull(),
    discountCode: text("discount_code"),
    discountTotalPaise: integer("discount_total_paise").notNull().default(0),
    taxTotalPaise: integer("tax_total_paise").notNull().default(0),
    shippingTotalPaise: integer("shipping_total_paise").notNull().default(0),
    grandTotalPaise: integer("grand_total_paise").notNull(),
    currency: text("currency").notNull().default("INR"),
    shippingName: text("shipping_name").notNull(),
    shippingPhone: text("shipping_phone"),
    shippingAddressLine1: text("shipping_address_line_1").notNull(),
    shippingAddressLine2: text("shipping_address_line_2"),
    shippingCity: text("shipping_city").notNull(),
    shippingState: text("shipping_state"),
    shippingPostalCode: text("shipping_postal_code").notNull(),
    shippingCountry: text("shipping_country").notNull().default("IN"),
    trackingNumber: text("tracking_number"),
    carrier: text("carrier"),
    adminNote: text("admin_note"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("orders_store_order_number_unique").on(table.storeId, table.orderNumber),
    uniqueIndex("orders_store_idempotency_key_unique")
      .on(table.storeId, table.idempotencyKey)
      .where(sql`${table.idempotencyKey} is not null`),
    index("orders_store_id_idx").on(table.storeId, table.id),
    index("orders_store_customer_idx").on(table.storeId, table.customerId),
    index("orders_store_status_idx").on(table.storeId, table.status),
    index("orders_store_created_at_idx").on(table.storeId, table.createdAt),
    index("orders_store_email_idx").on(table.storeId, table.email),
  ],
);
