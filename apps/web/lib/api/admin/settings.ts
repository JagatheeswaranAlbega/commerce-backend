import { apiFetch } from "@/lib/api"

export type ShippingMode = "flat" | "free_over" | "off"

export type AdminStoreShippingSettings = {
  mode: ShippingMode
  flatPaise: number
  freeOverPaise: number | null
}

export type AdminStoreTaxSettings = {
  gstPercent: number
  gstin: string | null
}

export type AdminStoreSettings = {
  name: string
  slug: string
  status: string
  domain: string | null
  contactEmail: string | null
  currency: string
  timezone: string
  shipping: AdminStoreShippingSettings
  tax: AdminStoreTaxSettings
}

export type UpdateAdminStoreSettingsInput = {
  name?: string
  domain?: string | null
  contactEmail?: string | null
  timezone?: string
  shipping?: AdminStoreShippingSettings
  tax?: AdminStoreTaxSettings
}

export function getAdminSettings(): Promise<AdminStoreSettings> {
  return apiFetch<AdminStoreSettings>("/admin/settings", { auth: "session" })
}

export function updateAdminSettings(
  input: UpdateAdminStoreSettingsInput
): Promise<AdminStoreSettings> {
  return apiFetch<AdminStoreSettings>("/admin/settings", {
    method: "PATCH",
    auth: "session",
    body: JSON.stringify(input),
  })
}
