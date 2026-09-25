import type { Database } from "@/db/client";
import { auditLogs } from "@/db/schema/audit-logs";
import type { RequestAuthContext } from "@/modules/auth/auth.types";

export type AuditWriteInput = {
  storeId?: string | null;
  actorUserId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export const AUDIT_ACTIONS = {
  STORE_CREATE: "store.create",
  STORE_ACTIVATE: "store.activate",
  STORE_DEACTIVATE: "store.deactivate",
  STORE_DELETE: "store.delete",
  STORE_ADMIN_CREATE: "store_admin.create",
  PRODUCT_CREATE: "product.create",
  PRODUCT_UPDATE: "product.update",
  PRODUCT_DELETE: "product.delete",
  GLOBAL_PRODUCT_IMPORT: "global_product.import",
  GLOBAL_PRODUCT_CATEGORY_UPDATE: "global_product.category_update",
  GLOBAL_PRODUCT_REMOVE: "global_product.remove",
  GLOBAL_PRODUCT_CREATE: "global_product.create",
  GLOBAL_PRODUCT_DELETE: "global_product.delete",
  GLOBAL_CATEGORY_CREATE: "global_category.create",
  GLOBAL_CATEGORY_DELETE: "global_category.delete",
  INVENTORY_ADJUST: "inventory.adjust",
  ORDER_STATUS_CHANGE: "order.status_change",
  ORDER_FULFILL: "order.fulfill",
  ORDER_RETURN_APPROVE: "order_return.approve",
  ORDER_RETURN_REJECT: "order_return.reject",
  API_KEY_CREATE: "api_key.create",
  API_KEY_REVOKE: "api_key.revoke",
} as const;

/** Strip secrets/passwords before persisting audit metadata. */
export function sanitizeAuditMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!metadata) return null;
  const blocked = new Set([
    "password",
    "adminPassword",
    "rawKey",
    "publishableKey",
    "secretKey",
    "keys",
    "authorization",
    "token",
    "refreshToken",
    "accessToken",
  ]);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (blocked.has(key)) continue;
    if (typeof value === "string" && /^(pk_live_|sk_live_)/.test(value)) continue;
    out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export async function writeAuditLog(db: Database, input: AuditWriteInput) {
  await db.insert(auditLogs).values({
    storeId: input.storeId ?? null,
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    metadata: sanitizeAuditMetadata(input.metadata ?? null),
  });
}

export function actorFromAuth(auth: RequestAuthContext | undefined): {
  actorUserId: string | null;
  storeId: string | null;
} {
  return {
    actorUserId: auth?.userId ?? null,
    storeId: auth?.storeId ?? null,
  };
}
