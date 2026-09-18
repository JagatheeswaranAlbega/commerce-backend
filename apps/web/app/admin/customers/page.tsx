"use client"

import { PermissionGate } from "@/components/admin/permission-gate"
import { RoleSwitch } from "@/components/admin/role-switch"
import { PlatformCustomers } from "@/components/admin/views/platform-customers"
import { StoreCustomers } from "@/components/admin/views/store-customers"

export default function AdminCustomersPage() {
  return (
    <PermissionGate permission="customers.read">
      <RoleSwitch
        platform={<PlatformCustomers />}
        store={<StoreCustomers />}
      />
    </PermissionGate>
  )
}
