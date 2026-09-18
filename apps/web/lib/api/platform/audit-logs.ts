import { apiFetchList, toQueryString, type PaginationMeta } from "@/lib/api"

export type PlatformAuditLog = {
  id: string
  storeId: string | null
  actorUserId: string | null
  action: string
  resourceType: string
  resourceId: string | null
  metadata: unknown
  createdAt: string
}

export function listPlatformAuditLogs(input?: {
  page?: number
  pageSize?: number
  storeId?: string
  action?: string
}): Promise<{ data: PlatformAuditLog[]; pagination?: PaginationMeta }> {
  return apiFetchList<PlatformAuditLog[]>(
    `/platform/audit-logs${toQueryString({
      page: input?.page,
      pageSize: input?.pageSize,
      storeId: input?.storeId,
      action: input?.action,
    })}`,
    { auth: "session" }
  )
}
