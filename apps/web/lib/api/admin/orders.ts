import { apiFetch, apiFetchList, toQueryString, type PaginationMeta } from "@/lib/api"

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED"

export type AdminOrderItem = {
  id: string
  productTitle: string
  variantTitle: string
  sku: string
  unitPricePaise: number
  quantity: number
  lineTotalPaise: number
}

export type AdminOrder = {
  id: string
  orderNumber: string
  status: OrderStatus
  email?: string | null
  adminNote?: string | null
  subtotalPaise?: number
  discountCode?: string | null
  discountTotalPaise?: number
  taxTotalPaise?: number
  shippingTotalPaise?: number
  grandTotalPaise: number
  currency?: string
  customerId: string | null
  shippingName?: string
  shippingPhone?: string | null
  shippingAddressLine1?: string
  shippingAddressLine2?: string | null
  shippingCity?: string
  shippingState?: string | null
  shippingPostalCode?: string
  shippingCountry?: string
  trackingNumber?: string | null
  carrier?: string | null
  createdAt: string
  updatedAt?: string
  items?: AdminOrderItem[]
  returns?: Array<{
    id: string
    status: "REQUESTED" | "APPROVED" | "REJECTED"
    reason: string
    decisionNote?: string | null
    decidedAt?: string | null
    createdAt: string
  }>
}

export function listAdminOrders(input?: {
  page?: number
  pageSize?: number
  status?: OrderStatus
  q?: string
  from?: string
  to?: string
}): Promise<{ data: AdminOrder[]; pagination?: PaginationMeta }> {
  return apiFetchList<AdminOrder[]>(
    `/admin/orders${toQueryString({
      page: input?.page,
      pageSize: input?.pageSize,
      status: input?.status,
      q: input?.q,
      from: input?.from,
      to: input?.to,
    })}`,
    { auth: "session" }
  )
}

export function getAdminOrder(orderId: string): Promise<AdminOrder> {
  return apiFetch<AdminOrder>(`/admin/orders/${orderId}`, { auth: "session" })
}

export function updateAdminOrder(
  orderId: string,
  input: { status?: OrderStatus; adminNote?: string | null }
): Promise<AdminOrder> {
  return apiFetch<AdminOrder>(`/admin/orders/${orderId}`, {
    method: "PATCH",
    auth: "session",
    body: JSON.stringify(input),
  })
}

export function fulfillAdminOrder(
  orderId: string,
  input?: {
    trackingNumber?: string
    carrier?: string
    status?: "PROCESSING" | "SHIPPED" | "DELIVERED"
  }
): Promise<AdminOrder> {
  return apiFetch<AdminOrder>(`/admin/orders/${orderId}/fulfillment`, {
    method: "POST",
    auth: "session",
    body: JSON.stringify(input ?? {}),
  })
}
