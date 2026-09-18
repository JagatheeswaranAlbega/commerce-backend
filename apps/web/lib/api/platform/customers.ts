import { apiFetch, apiFetchList, toQueryString, type PaginationMeta } from "@/lib/api"

export type PlatformCustomer = {
  id: string
  storeId: string
  email: string | null
  name: string | null
  phone: string | null
  createdAt: string
  updatedAt?: string
  orders?: Array<{
    id: string
    orderNumber: string
    status: string
    grandTotalPaise: number
    createdAt: string
  }>
}

export function listPlatformCustomers(input?: {
  page?: number
  pageSize?: number
  storeId?: string
}): Promise<{ data: PlatformCustomer[]; pagination?: PaginationMeta }> {
  return apiFetchList<PlatformCustomer[]>(
    `/platform/customers${toQueryString({
      page: input?.page,
      pageSize: input?.pageSize,
      storeId: input?.storeId,
    })}`,
    { auth: "session" }
  )
}

export function getPlatformCustomer(customerId: string): Promise<PlatformCustomer> {
  return apiFetch<PlatformCustomer>(`/platform/customers/${customerId}`, {
    auth: "session",
  })
}
