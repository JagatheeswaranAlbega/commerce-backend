import { apiFetch, apiFetchList, toQueryString, type PaginationMeta } from "@/lib/api"

export type PlatformStoreAdmin = {
  id: string
  email: string
  storeId: string
  storeName?: string | null
  isActive?: boolean
  createdAt: string
  updatedAt?: string
}

export type CreateStoreAdminInput = {
  email: string
  password: string
}

export type UpdateStoreAdminInput = {
  email?: string
  password?: string
  isActive?: boolean
}

export function listStoreAdmins(
  storeId: string,
  input?: { page?: number; pageSize?: number }
): Promise<{ data: PlatformStoreAdmin[]; pagination?: PaginationMeta }> {
  return apiFetchList<PlatformStoreAdmin[]>(
    `/platform/stores/${storeId}/admins${toQueryString({
      page: input?.page,
      pageSize: input?.pageSize,
    })}`,
    { auth: "session" }
  )
}

export function createStoreAdmin(
  storeId: string,
  input: CreateStoreAdminInput
): Promise<PlatformStoreAdmin> {
  return apiFetch<PlatformStoreAdmin>(`/platform/stores/${storeId}/admins`, {
    method: "POST",
    auth: "session",
    body: JSON.stringify(input),
  })
}

export function updateStoreAdmin(
  storeId: string,
  userId: string,
  input: UpdateStoreAdminInput
): Promise<PlatformStoreAdmin> {
  return apiFetch<PlatformStoreAdmin>(
    `/platform/stores/${storeId}/admins/${userId}`,
    {
      method: "PATCH",
      auth: "session",
      body: JSON.stringify(input),
    }
  )
}

export function deleteStoreAdmin(
  storeId: string,
  userId: string
): Promise<void> {
  return apiFetch<void>(`/platform/stores/${storeId}/admins/${userId}`, {
    method: "DELETE",
    auth: "session",
  })
}
