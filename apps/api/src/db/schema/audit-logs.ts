import { index, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./columns";
import { stores } from "./stores";
import { users } from "./users";

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "set null" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    metadata: jsonb("metadata"),
    ...timestamps,
  },
  (table) => [
    index("audit_logs_store_id_idx").on(table.storeId),
    index("audit_logs_actor_idx").on(table.actorUserId),
    index("audit_logs_created_at_idx").on(table.createdAt),
    index("audit_logs_action_idx").on(table.action),
  ],
);
