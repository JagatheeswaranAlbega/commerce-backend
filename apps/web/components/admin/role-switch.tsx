"use client"

import type { ReactNode } from "react"

import { DataTableSkeleton } from "@/components/admin/data-table-skeleton"
import { useAdminPermissions } from "@/components/admin/permission-gate"
import { isPlatformScope } from "@/lib/permissions"

type RoleSwitchProps = {
  platform: ReactNode
  store: ReactNode
}

export function RoleSwitch({ platform, store }: RoleSwitchProps) {
  const { permissions, isLoading, user } = useAdminPermissions()

  if (isLoading || !user) {
    return <DataTableSkeleton columns={3} rows={4} />
  }

  return isPlatformScope(permissions) ? platform : store
}
