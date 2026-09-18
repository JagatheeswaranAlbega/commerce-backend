"use client"

import { PermissionGate } from "@/components/admin/permission-gate"
import { RoleSwitch } from "@/components/admin/role-switch"
import { PlatformKeys } from "@/components/admin/views/platform-keys"
import { StoreKeys } from "@/components/admin/views/store-keys"

export default function AdminKeysPage() {
  return (
    <PermissionGate permission="api_keys.read">
      <RoleSwitch platform={<PlatformKeys />} store={<StoreKeys />} />
    </PermissionGate>
  )
}
