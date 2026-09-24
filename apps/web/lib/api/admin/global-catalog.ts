import { apiFetch, apiFetchList, toQueryString, type PaginationMeta } from "@/lib/api"

import type {
  GlobalCategory,
  GlobalCategoryStatus,
  GlobalProduct,
  GlobalProductDetail,
  GlobalProductStatus,
} from "@/lib/api/platform/global-catalog"

export type BulkImportGlobalProductsResult = {
  imported: Array<GlobalProduct & { associationId: string; importedAt: string }>
  failed: Array<{ productId: string; message: string; code: string | null }>
  importedCount: number
  failedCount: number
}

export async function listAdminGlobalCategories(params?: {
  status?: GlobalCategoryStatus
}) {
  return apiFetch<GlobalCategory[]>(
    `/admin/global-catalog/categories${toQueryString(params ?? {})}`,
    { auth: "session" }
  )
}

export async function listAdminGlobalProducts(params?: {
  page?: number
  pageSize?: number
  status?: GlobalProductStatus
  categoryId?: string
  q?: string
  imported?: boolean
}): Promise<{ data: GlobalProduct[]; pagination?: PaginationMeta }> {
  return apiFetchList<GlobalProduct[]>(
    `/admin/global-catalog/products${toQueryString(params ?? {})}`,
    { auth: "session" }
  )
}

export async function getAdminGlobalProduct(productId: string) {
  return apiFetch<GlobalProductDetail>(`/admin/global-catalog/products/${productId}`, {
    auth: "session",
  })
}

export async function importAdminGlobalProduct(productId: string) {
  return apiFetch<GlobalProduct & { associationId: string; importedAt: string }>(
    `/admin/global-catalog/products/${productId}/import`,
    {
      method: "POST",
      auth: "session",
    }
  )
}

export async function importAdminGlobalProducts(productIds: string[]) {
  return apiFetch<BulkImportGlobalProductsResult>(`/admin/global-catalog/products/import`, {
    method: "POST",
    auth: "session",
    silent: true,
    body: JSON.stringify({ productIds }),
  })
}

export async function removeAdminGlobalProductImport(productId: string) {
  return apiFetch<{ id: string }>(`/admin/global-catalog/products/${productId}/import`, {
    method: "DELETE",
    auth: "session",
  })
}
