"use client"

import { PlatformDashboard } from "@/components/admin/views/platform-dashboard"
import { StoreDashboard } from "@/components/admin/views/store-dashboard"
import { PermissionGate } from "@/components/admin/permission-gate"
import { RoleSwitch } from "@/components/admin/role-switch"

export default function AdminDashboardPage() {
  return (
    <PermissionGate permission="dashboard.read">
      <RoleSwitch
        platform={<PlatformDashboard />}
        store={<StoreDashboard />}
      />
    </PermissionGate>
  )
}
