import { apiFetch } from "@/lib/api"

export type AdminApiKey = {
  id: string
  storeId: string
  type: "PUBLISHABLE" | "SECRET"
  keyPrefix: string
  status: "ACTIVE" | "REVOKED"
  createdAt: string
}

export type CreateAdminApiKeyResult = AdminApiKey & { rawKey: string }

export function listAdminKeys(): Promise<AdminApiKey[]> {
  return apiFetch<AdminApiKey[]>("/admin/keys", { auth: "session" })
}

export function createAdminKey(
  type: "PUBLISHABLE" | "SECRET"
): Promise<CreateAdminApiKeyResult> {
  return apiFetch<CreateAdminApiKeyResult>("/admin/keys", {
    method: "POST",
    auth: "session",
    body: JSON.stringify({ type }),
  })
}

export function revokeAdminKey(keyId: string): Promise<{ id: string; deleted: true }> {
  return apiFetch<{ id: string; deleted: true }>(`/admin/keys/${keyId}`, {
    method: "DELETE",
    auth: "session",
  })
}
