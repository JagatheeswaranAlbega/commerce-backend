import { apiFetch, apiFetchList, toQueryString, type PaginationMeta } from "@/lib/api"

export type PlatformOrder = {
  id: string
  storeId: string
  storeName?: string | null
  orderNumber: string
  status: string
  email?: string | null
  subtotalPaise?: number
  discountCode?: string | null
  discountTotalPaise?: number
  taxTotalPaise?: number
  shippingTotalPaise?: number
  grandTotalPaise: number
  trackingNumber?: string | null
  carrier?: string | null
  shippingName?: string
  shippingAddressLine1?: string
  shippingCity?: string
  shippingPostalCode?: string
  shippingCountry?: string
  createdAt: string
  updatedAt?: string
  items?: Array<{
    id: string
    productTitle: string
    variantTitle: string
    sku: string
    unitPricePaise: number
    quantity: number
    lineTotalPaise: number
  }>
}

export function listPlatformOrders(input?: {
  page?: number
  pageSize?: number
  storeId?: string
  status?: string
  q?: string
}): Promise<{ data: PlatformOrder[]; pagination?: PaginationMeta }> {
  return apiFetchList<PlatformOrder[]>(
    `/platform/orders${toQueryString({
      page: input?.page,
      pageSize: input?.pageSize,
      storeId: input?.storeId,
      status: input?.status,
      q: input?.q,
    })}`,
    { auth: "session" }
  )
}

export function getPlatformOrder(orderId: string): Promise<PlatformOrder> {
  return apiFetch<PlatformOrder>(`/platform/orders/${orderId}`, {
    auth: "session",
  })
}
