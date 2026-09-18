"use client"

import { PermissionGate } from "@/components/admin/permission-gate"
import { RoleSwitch } from "@/components/admin/role-switch"
import { PlatformOrders } from "@/components/admin/views/platform-orders"
import { StoreOrders } from "@/components/admin/views/store-orders"

export default function AdminOrdersPage() {
  return (
    <PermissionGate permission="orders.read">
      <RoleSwitch platform={<PlatformOrders />} store={<StoreOrders />} />
    </PermissionGate>
  )
}
