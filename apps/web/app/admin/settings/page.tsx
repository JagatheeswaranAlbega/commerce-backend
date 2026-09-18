"use client"

import { PermissionGate } from "@/components/admin/permission-gate"
import { RoleSwitch } from "@/components/admin/role-switch"
import { PlatformSettings } from "@/components/admin/views/platform-settings"
import { StoreSettings } from "@/components/admin/views/store-settings"

export default function AdminSettingsPage() {
  return (
    <PermissionGate permission="settings.read">
      <RoleSwitch
        platform={<PlatformSettings />}
        store={<StoreSettings />}
      />
    </PermissionGate>
  )
}
