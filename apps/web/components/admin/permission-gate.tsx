"use client"

import { useQuery } from "@tanstack/react-query"
import type { ReactNode } from "react"

import { getMe } from "@/lib/auth"
import {
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  permissionsForRole,
  type Permission,
} from "@/lib/permissions"

type PermissionGateProps = {
  permission?: Permission
  anyOf?: readonly Permission[]
  allOf?: readonly Permission[]
  children: ReactNode
  fallback?: ReactNode
}

function UnauthorizedMessage() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-medium">Unauthorized</h1>
      <p className="text-sm text-muted-foreground">
        You do not have permission to access this page.
      </p>
    </div>
  )
}

export function PermissionGate({
  permission,
  anyOf,
  allOf,
  children,
  fallback,
}: PermissionGateProps) {
  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getMe,
    retry: false,
  })

  if (meQuery.isLoading) {
    return (
      <p className="text-sm text-muted-foreground">Checking permissions...</p>
    )
  }

  if (!meQuery.data) {
    return fallback ?? <UnauthorizedMessage />
  }

  const permissions = permissionsForRole(meQuery.data.role)
  const allowed =
    (permission ? hasPermission(permissions, permission) : true) &&
    (anyOf ? hasAnyPermission(permissions, anyOf) : true) &&
    (allOf ? hasAllPermissions(permissions, allOf) : true)

  if (!allowed) {
    return fallback ?? <UnauthorizedMessage />
  }

  return children
}

export function useAdminPermissions() {
  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getMe,
    retry: false,
  })

  const permissions = meQuery.data
    ? permissionsForRole(meQuery.data.role)
    : undefined

  return {
    user: meQuery.data,
    permissions,
    isLoading: meQuery.isLoading,
    isError: meQuery.isError,
    error: meQuery.error,
    can: (permission: Permission) => hasPermission(permissions, permission),
  }
}
