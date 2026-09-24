"use client"

import { PermissionGate } from "@/components/admin/permission-gate"
import { RoleSwitch } from "@/components/admin/role-switch"
import { PlatformGlobalCatalog } from "@/components/admin/views/platform-global-catalog"
import { StoreGlobalCatalog } from "@/components/admin/views/store-global-catalog"

export default function GlobalCatalogPage() {
  return (
    <PermissionGate permission="global_catalog.read">
      <RoleSwitch
        platform={<PlatformGlobalCatalog />}
        store={<StoreGlobalCatalog />}
      />
    </PermissionGate>
  )
}
