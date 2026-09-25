import { apiFetch, apiFetchList, toQueryString, type PaginationMeta } from "@/lib/api"

import type {
  GlobalCategory,
  GlobalCategoryStatus,
  GlobalProduct,
  GlobalProductDetail,
  GlobalProductStatus,
} from "@/lib/api/platform/global-catalog"

export type ImportStoreCategoryAssignment =
  | { storeCategoryId: string; newCategory?: undefined }
  | { storeCategoryId?: undefined; newCategory: { name: string; slug: string } }

export type ImportedGlobalProduct = GlobalProduct & {
  associationId: string
  importedAt: string
  storeCategoryId: string | null
}

export type BulkImportGlobalProductsResult = {
  imported: ImportedGlobalProduct[]
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

export async function importAdminGlobalProduct(
  productId: string,
  assignment: ImportStoreCategoryAssignment
) {
  return apiFetch<ImportedGlobalProduct>(
    `/admin/global-catalog/products/${productId}/import`,
    {
      method: "POST",
      auth: "session",
      body: JSON.stringify(assignment),
    }
  )
}

export async function importAdminGlobalProducts(
  productIds: string[],
  assignment: ImportStoreCategoryAssignment
) {
  return apiFetch<BulkImportGlobalProductsResult>(`/admin/global-catalog/products/import`, {
    method: "POST",
    auth: "session",
    silent: true,
    body: JSON.stringify({ productIds, ...assignment }),
  })
}

export async function remapAdminGlobalProductCategory(
  productId: string,
  assignment: ImportStoreCategoryAssignment
) {
  return apiFetch<ImportedGlobalProduct>(
    `/admin/global-catalog/products/${productId}/import`,
    {
      method: "PATCH",
      auth: "session",
      body: JSON.stringify(assignment),
    }
  )
}

export async function removeAdminGlobalProductImport(productId: string) {
  return apiFetch<{ id: string }>(`/admin/global-catalog/products/${productId}/import`, {
    method: "DELETE",
    auth: "session",
  })
}
