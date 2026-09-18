import { apiFetch, apiFetchList, toQueryString, type PaginationMeta } from "@/lib/api"
import type { OrderStatus } from "@/lib/api/admin/orders"

export type OrderReturnStatus = "REQUESTED" | "APPROVED" | "REJECTED"

export type AdminOrderReturn = {
  id: string
  storeId: string
  orderId: string
  customerId: string | null
  status: OrderReturnStatus
  reason: string
  decisionNote?: string | null
  decidedAt?: string | null
  createdAt: string
  updatedAt?: string
  order?: {
    id: string
    orderNumber: string
    status: OrderStatus
    grandTotalPaise: number
    createdAt: string
  } | null
  customer?: {
    id: string
    email: string | null
    name: string | null
    phone?: string | null
  } | null
}

export function listAdminReturns(input?: {
  page?: number
  pageSize?: number
  status?: OrderReturnStatus
}): Promise<{ data: AdminOrderReturn[]; pagination?: PaginationMeta }> {
  return apiFetchList<AdminOrderReturn[]>(
    `/admin/returns${toQueryString({
      page: input?.page,
      pageSize: input?.pageSize,
      status: input?.status,
    })}`,
    { auth: "session" }
  )
}

export function getAdminReturn(returnId: string): Promise<AdminOrderReturn> {
  return apiFetch<AdminOrderReturn>(`/admin/returns/${returnId}`, {
    auth: "session",
  })
}

export function approveAdminReturn(returnId: string): Promise<AdminOrderReturn> {
  return apiFetch<AdminOrderReturn>(`/admin/returns/${returnId}/approve`, {
    method: "POST",
    auth: "session",
    body: JSON.stringify({}),
  })
}

export function rejectAdminReturn(
  returnId: string,
  input?: { reason?: string }
): Promise<AdminOrderReturn> {
  return apiFetch<AdminOrderReturn>(`/admin/returns/${returnId}/reject`, {
    method: "POST",
    auth: "session",
    body: JSON.stringify(input ?? {}),
  })
}
