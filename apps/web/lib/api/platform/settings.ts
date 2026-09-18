import { apiFetch } from "@/lib/api"

export type PlatformSettings = {
  platformName: string
  supportEmail: string | null
  defaultCurrency: "INR"
}

export type UpdatePlatformSettingsInput = {
  platformName?: string
  supportEmail?: string | null
}

export function getPlatformSettings(): Promise<PlatformSettings> {
  return apiFetch<PlatformSettings>("/platform/settings", { auth: "session" })
}

export function updatePlatformSettings(
  input: UpdatePlatformSettingsInput
): Promise<PlatformSettings> {
  return apiFetch<PlatformSettings>("/platform/settings", {
    method: "PATCH",
    auth: "session",
    body: JSON.stringify(input),
  })
}
