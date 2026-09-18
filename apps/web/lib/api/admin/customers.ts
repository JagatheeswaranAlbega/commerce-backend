import { apiFetch, apiFetchList, toQueryString, type PaginationMeta } from "@/lib/api"
import type { AdminOrder } from "@/lib/api/admin/orders"

export type AdminCustomerAddress = {
  id: string
  name: string
  phone: string | null
  addressLine1: string
  addressLine2: string | null
  city: string
  state: string | null
  postalCode: string
  country: string
  isDefault: boolean
}

export type AdminCustomer = {
  id: string
  email: string | null
  name: string | null
  phone: string | null
  createdAt: string
  updatedAt?: string
  storeId?: string
  addresses?: AdminCustomerAddress[]
  orders?: AdminOrder[]
}

export function listAdminCustomers(input?: {
  page?: number
  pageSize?: number
  q?: string
}): Promise<{ data: AdminCustomer[]; pagination?: PaginationMeta }> {
  return apiFetchList<AdminCustomer[]>(
    `/admin/customers${toQueryString({
      page: input?.page,
      pageSize: input?.pageSize,
      q: input?.q,
    })}`,
    { auth: "session" }
  )
}

export function getAdminCustomer(customerId: string): Promise<AdminCustomer> {
  return apiFetch<AdminCustomer>(`/admin/customers/${customerId}`, {
    auth: "session",
  })
}
