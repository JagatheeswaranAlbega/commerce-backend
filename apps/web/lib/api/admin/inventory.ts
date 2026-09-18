import { apiFetch, apiFetchList, toQueryString, type PaginationMeta } from "@/lib/api"

export type AdminInventoryRow = {
  id: string
  variantId: string
  sku: string | null
  variantName: string | null
  productName: string | null
  availableQuantity: number
  reservedQuantity: number
  updatedAt?: string
}

export function listAdminInventory(input?: {
  page?: number
  pageSize?: number
  q?: string
}): Promise<{ data: AdminInventoryRow[]; pagination?: PaginationMeta }> {
  return apiFetchList<AdminInventoryRow[]>(
    `/admin/inventory${toQueryString({
      page: input?.page,
      pageSize: input?.pageSize,
      q: input?.q,
    })}`,
    { auth: "session" }
  )
}

export function getAdminInventory(
  variantId: string
): Promise<AdminInventoryRow> {
  return apiFetch<AdminInventoryRow>(`/admin/inventory/${variantId}`, {
    auth: "session",
  })
}

export function adjustAdminInventory(
  variantId: string,
  input: { delta: number; reason?: string }
): Promise<AdminInventoryRow> {
  return apiFetch<AdminInventoryRow>(
    `/admin/inventory/${variantId}/adjust`,
    {
      method: "POST",
      auth: "session",
      body: JSON.stringify(input),
    }
  )
}

export function setAdminInventory(
  variantId: string,
  input: { quantity: number; reason?: string }
): Promise<AdminInventoryRow> {
  return apiFetch<AdminInventoryRow>(`/admin/inventory/${variantId}/set`, {
    method: "POST",
    auth: "session",
    body: JSON.stringify(input),
  })
}

export function listAdminInventoryMovements(
  variantId: string,
  input?: { page?: number; pageSize?: number }
): Promise<{
  data: Array<{
    id: string
    type: string
    quantity: number
    reference: string | null
    createdAt: string
  }>
  pagination?: PaginationMeta
}> {
  return apiFetchList(
    `/admin/inventory/${variantId}/movements${toQueryString({
      page: input?.page,
      pageSize: input?.pageSize,
    })}`,
    { auth: "session" }
  )
}
