import type { AuthRole } from "@/lib/auth-cookie"

export const PERMISSIONS = [
  "dashboard.read",
  "stores.read",
  "stores.manage",
  "store_admins.read",
  "store_admins.manage",
  "products.read",
  "products.manage",
  "global_catalog.read",
  "global_catalog.manage",
  "global_catalog.import",
  "categories.read",
  "categories.manage",
  "collections.read",
  "collections.manage",
  "inventory.read",
  "inventory.manage",
  "media.read",
  "media.manage",
  "orders.read",
  "orders.manage",
  "discounts.read",
  "discounts.manage",
  "customers.read",
  "api_keys.read",
  "api_keys.manage",
  "settings.read",
  "settings.manage",
  "audit_logs.read",
  "platform.metrics",
] as const

export type Permission = (typeof PERMISSIONS)[number]

const PLATFORM_PERMISSIONS: Permission[] = [
  "dashboard.read",
  "platform.metrics",
  "stores.read",
  "stores.manage",
  "store_admins.read",
  "store_admins.manage",
  "products.read",
  "products.manage",
  "global_catalog.read",
  "global_catalog.manage",
  "orders.read",
  "customers.read",
  "api_keys.read",
  "api_keys.manage",
  "settings.read",
  "settings.manage",
  "audit_logs.read",
]

const STORE_PERMISSIONS: Permission[] = [
  "dashboard.read",
  "products.read",
  "products.manage",
  "global_catalog.read",
  "global_catalog.import",
  "categories.read",
  "categories.manage",
  "collections.read",
  "collections.manage",
  "inventory.read",
  "inventory.manage",
  "media.read",
  "media.manage",
  "orders.read",
  "orders.manage",
  "discounts.read",
  "discounts.manage",
  "customers.read",
  "api_keys.read",
  "api_keys.manage",
  "settings.read",
  "settings.manage",
]

export const ROLE_PERMISSIONS: Record<AuthRole, readonly Permission[]> = {
  PLATFORM_SUPER_ADMIN: PLATFORM_PERMISSIONS,
  STORE_ADMIN: STORE_PERMISSIONS,
}

export function permissionsForRole(role: AuthRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role]
}

export function hasPermission(
  permissions: readonly Permission[] | undefined,
  permission: Permission
): boolean {
  return Boolean(permissions?.includes(permission))
}

export function hasAnyPermission(
  permissions: readonly Permission[] | undefined,
  required: readonly Permission[]
): boolean {
  return required.some((permission) => hasPermission(permissions, permission))
}

export function hasAllPermissions(
  permissions: readonly Permission[] | undefined,
  required: readonly Permission[]
): boolean {
  return required.every((permission) => hasPermission(permissions, permission))
}

/** Platform-scoped UI vs store-scoped UI for overlapping /admin routes. */
export function isPlatformScope(
  permissions: readonly Permission[] | undefined
): boolean {
  return hasPermission(permissions, "platform.metrics")
}
