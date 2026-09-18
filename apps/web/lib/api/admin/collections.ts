import { apiFetch, apiFetchList, toQueryString, type PaginationMeta } from "@/lib/api"

export type AdminCollection = {
  id: string
  name: string
  slug: string
  description?: string | null
  status?: "ACTIVE" | "INACTIVE"
  createdAt: string
  updatedAt?: string
}

export type AdminCollectionProduct = {
  id: string
  title: string
  handle: string
  status: string
}

export type CreateCollectionInput = {
  name: string
  slug: string
  description?: string | null
  status?: "ACTIVE" | "INACTIVE"
}

export type UpdateCollectionInput = {
  name?: string
  slug?: string
  description?: string | null
  status?: "ACTIVE" | "INACTIVE"
}

export function listAdminCollections(input?: {
  page?: number
  pageSize?: number
}): Promise<{ data: AdminCollection[]; pagination?: PaginationMeta }> {
  return apiFetchList<AdminCollection[]>(
    `/admin/collections${toQueryString({
      page: input?.page,
      pageSize: input?.pageSize,
    })}`,
    { auth: "session" }
  )
}

export function createAdminCollection(
  input: CreateCollectionInput
): Promise<AdminCollection> {
  return apiFetch<AdminCollection>("/admin/collections", {
    method: "POST",
    auth: "session",
    body: JSON.stringify(input),
  })
}

export function updateAdminCollection(
  collectionId: string,
  input: UpdateCollectionInput
): Promise<AdminCollection> {
  return apiFetch<AdminCollection>(`/admin/collections/${collectionId}`, {
    method: "PATCH",
    auth: "session",
    body: JSON.stringify(input),
  })
}

export function deleteAdminCollection(collectionId: string): Promise<void> {
  return apiFetch<void>(`/admin/collections/${collectionId}`, {
    method: "DELETE",
    auth: "session",
  })
}

export function listAdminCollectionProducts(
  collectionId: string
): Promise<{ data: AdminCollectionProduct[] }> {
  return apiFetchList<AdminCollectionProduct[]>(
    `/admin/collections/${collectionId}/products`,
    { auth: "session" }
  )
}

export function addAdminCollectionProduct(
  collectionId: string,
  productId: string
): Promise<AdminCollectionProduct> {
  return apiFetch<AdminCollectionProduct>(
    `/admin/collections/${collectionId}/products`,
    {
      method: "POST",
      auth: "session",
      body: JSON.stringify({ productId }),
    }
  )
}

export function removeAdminCollectionProduct(
  collectionId: string,
  productId: string
): Promise<void> {
  return apiFetch<void>(
    `/admin/collections/${collectionId}/products/${productId}`,
    {
      method: "DELETE",
      auth: "session",
    }
  )
}
