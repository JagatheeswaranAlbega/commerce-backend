"use client"

import { Suspense } from "react"

import { DataTableSkeleton } from "@/components/admin/data-table-skeleton"
import { PermissionGate } from "@/components/admin/permission-gate"
import { RoleSwitch } from "@/components/admin/role-switch"
import { PlatformSettings } from "@/components/admin/views/platform-settings"
import { StoreSettings } from "@/components/admin/views/store-settings"

export default function AdminSettingsPage() {
  return (
    <PermissionGate permission="settings.read">
      <Suspense fallback={<DataTableSkeleton columns={2} rows={6} />}>
        <RoleSwitch
          platform={<PlatformSettings />}
          store={<StoreSettings />}
        />
      </Suspense>
    </PermissionGate>
  )
}
