"use client"

import { PermissionGate } from "@/components/admin/permission-gate"
import { RoleSwitch } from "@/components/admin/role-switch"
import { PlatformCustomerDetail } from "@/components/admin/views/platform-customer-detail"
import { StoreCustomerDetail } from "@/components/admin/views/store-customer-detail"

export default function AdminCustomerDetailPage() {
  return (
    <PermissionGate permission="customers.read">
      <RoleSwitch
        platform={<PlatformCustomerDetail />}
        store={<StoreCustomerDetail />}
      />
    </PermissionGate>
  )
}
