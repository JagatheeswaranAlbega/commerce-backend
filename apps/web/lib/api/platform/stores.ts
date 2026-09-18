import { apiFetch, apiFetchList, toQueryString, type PaginationMeta } from "@/lib/api"

export type StoreStatus = "ACTIVE" | "INACTIVE"

export type PlatformStore = {
  id: string
  name: string
  slug: string
  status: StoreStatus
  domain: string | null
  createdAt: string
  updatedAt: string
}

export type PlatformStoreAdminSummary = {
  id: string
  email: string
  role: string
  storeId: string | null
}

export type CreateStoreInput = {
  name: string
  slug: string
  adminEmail: string
  adminPassword: string
}

export type CreateStoreResult = {
  store: PlatformStore
  admin: PlatformStoreAdminSummary
  keys: {
    publishableKey: string
    secretKey: string
  }
}

export type UpdateStoreInput = {
  name?: string
  status?: StoreStatus
}

export function listPlatformStores(input?: {
  page?: number
  pageSize?: number
  status?: StoreStatus
}): Promise<{ data: PlatformStore[]; pagination?: PaginationMeta }> {
  return apiFetchList<PlatformStore[]>(
    `/platform/stores${toQueryString({
      page: input?.page,
      pageSize: input?.pageSize,
      status: input?.status,
    })}`,
    { auth: "session" }
  )
}

export function getPlatformStore(storeId: string): Promise<PlatformStore> {
  return apiFetch<PlatformStore>(`/platform/stores/${storeId}`, {
    auth: "session",
  })
}

export function createPlatformStore(
  input: CreateStoreInput
): Promise<CreateStoreResult> {
  return apiFetch<CreateStoreResult>("/platform/stores", {
    method: "POST",
    auth: "session",
    body: JSON.stringify(input),
  })
}

export function updatePlatformStore(
  storeId: string,
  input: UpdateStoreInput
): Promise<PlatformStore> {
  return apiFetch<PlatformStore>(`/platform/stores/${storeId}`, {
    method: "PATCH",
    auth: "session",
    body: JSON.stringify(input),
  })
}

export function deletePlatformStore(storeId: string): Promise<PlatformStore> {
  return apiFetch<PlatformStore>(`/platform/stores/${storeId}`, {
    method: "DELETE",
    auth: "session",
  })
}
