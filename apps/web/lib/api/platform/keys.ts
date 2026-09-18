import { apiFetch, apiFetchList, toQueryString, type PaginationMeta } from "@/lib/api"

export type ApiKeyType = "PUBLISHABLE" | "SECRET"
export type ApiKeyStatus = "ACTIVE" | "REVOKED"

export type PlatformApiKey = {
  id: string
  storeId: string
  type: ApiKeyType
  keyPrefix: string
  status: ApiKeyStatus
  createdAt: string
  updatedAt?: string
  /** UI helper — derived from status */
  prefix?: string
  name?: string | null
  revokedAt?: string | null
}

export type CreateApiKeyResult = PlatformApiKey & {
  rawKey: string
}

export type CreateApiKeyInput = {
  type: ApiKeyType
}

function normalizeKey(key: PlatformApiKey): PlatformApiKey {
  return {
    ...key,
    prefix: key.keyPrefix ?? key.prefix ?? "",
    revokedAt: key.status === "REVOKED" ? key.updatedAt ?? key.createdAt : null,
  }
}

export async function listStoreKeys(
  storeId: string,
  input?: { page?: number; pageSize?: number }
): Promise<{ data: PlatformApiKey[]; pagination?: PaginationMeta }> {
  const result = await apiFetchList<PlatformApiKey[]>(
    `/platform/stores/${storeId}/keys${toQueryString({
      page: input?.page,
      pageSize: input?.pageSize,
    })}`,
    { auth: "session" }
  )
  return {
    ...result,
    data: result.data.map(normalizeKey),
  }
}

export async function createStoreKey(
  storeId: string,
  input: CreateApiKeyInput
): Promise<CreateApiKeyResult> {
  const key = await apiFetch<CreateApiKeyResult>(
    `/platform/stores/${storeId}/keys`,
    {
      method: "POST",
      auth: "session",
      body: JSON.stringify(input),
    }
  )
  return { ...normalizeKey(key), rawKey: key.rawKey } as CreateApiKeyResult
}

export function deleteStoreKey(
  storeId: string,
  keyId: string
): Promise<{ id: string; deleted: true }> {
  return apiFetch<{ id: string; deleted: true }>(
    `/platform/stores/${storeId}/keys/${keyId}`,
    {
      method: "DELETE",
      auth: "session",
    }
  )
}
