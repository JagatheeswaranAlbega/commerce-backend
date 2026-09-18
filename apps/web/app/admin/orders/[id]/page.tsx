"use client"

import { PermissionGate } from "@/components/admin/permission-gate"
import { RoleSwitch } from "@/components/admin/role-switch"
import { PlatformOrderDetail } from "@/components/admin/views/platform-order-detail"
import { StoreOrderDetail } from "@/components/admin/views/store-order-detail"

export default function AdminOrderDetailPage() {
  return (
    <PermissionGate permission="orders.read">
      <RoleSwitch
        platform={<PlatformOrderDetail />}
        store={<StoreOrderDetail />}
      />
    </PermissionGate>
  )
}
