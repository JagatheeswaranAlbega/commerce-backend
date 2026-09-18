import { apiFetch, apiFetchList, toQueryString, type PaginationMeta } from "@/lib/api"

export type CategoryStatus = "ACTIVE" | "INACTIVE"

export type AdminCategory = {
  id: string
  name: string
  slug: string
  parentId: string | null
  status: CategoryStatus
  createdAt: string
}

export type CreateCategoryInput = {
  name: string
  slug: string
  parentId?: string | null
  status?: CategoryStatus
}

export type UpdateCategoryInput = {
  name?: string
  slug?: string
  parentId?: string | null
  status?: CategoryStatus
}

export function listAdminCategories(input?: {
  page?: number
  pageSize?: number
}): Promise<{ data: AdminCategory[]; pagination?: PaginationMeta }> {
  return apiFetchList<AdminCategory[]>(
    `/admin/categories${toQueryString({
      page: input?.page,
      pageSize: input?.pageSize,
    })}`,
    { auth: "session" }
  )
}

export function createAdminCategory(
  input: CreateCategoryInput
): Promise<AdminCategory> {
  return apiFetch<AdminCategory>("/admin/categories", {
    method: "POST",
    auth: "session",
    body: JSON.stringify(input),
  })
}

export function updateAdminCategory(
  categoryId: string,
  input: UpdateCategoryInput
): Promise<AdminCategory> {
  return apiFetch<AdminCategory>(`/admin/categories/${categoryId}`, {
    method: "PATCH",
    auth: "session",
    body: JSON.stringify(input),
  })
}

export function deleteAdminCategory(categoryId: string): Promise<void> {
  return apiFetch<void>(`/admin/categories/${categoryId}`, {
    method: "DELETE",
    auth: "session",
  })
}
