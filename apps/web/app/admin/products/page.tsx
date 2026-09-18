"use client"

import { PermissionGate } from "@/components/admin/permission-gate"
import { RoleSwitch } from "@/components/admin/role-switch"
import { PlatformProducts } from "@/components/admin/views/platform-products"
import { StoreProducts } from "@/components/admin/views/store-products"

export default function AdminProductsPage() {
  return (
    <PermissionGate permission="products.read">
      <RoleSwitch
        platform={<PlatformProducts />}
        store={<StoreProducts />}
      />
    </PermissionGate>
  )
}
