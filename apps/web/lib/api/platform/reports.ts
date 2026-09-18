import { apiFetch, toQueryString } from "@/lib/api"
import { getAccessToken } from "@/lib/auth-cookie"
import type { SalesReport } from "@/lib/api/admin/reports"

export function getPlatformSalesReport(input: {
  storeId: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}): Promise<SalesReport> {
  return apiFetch<SalesReport>(
    `/platform/reports/sales${toQueryString({
      storeId: input.storeId,
      from: input.from,
      to: input.to,
      page: input.page,
      pageSize: input.pageSize,
    })}`,
    { auth: "session" }
  )
}

function getApiBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL?.trim()
  if (!baseUrl) throw new Error("API URL is not configured.")
  return baseUrl.replace(/\/$/, "")
}

export async function downloadPlatformSalesCsv(input: {
  storeId: string
  from?: string
  to?: string
}): Promise<void> {
  const token = getAccessToken()
  const response = await fetch(
    `${getApiBaseUrl()}/api/v1/platform/reports/sales/export${toQueryString({
      storeId: input.storeId,
      from: input.from,
      to: input.to,
    })}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }
  )
  if (!response.ok) {
    throw new Error("Failed to download sales CSV.")
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `sales-export.csv`
  a.click()
  URL.revokeObjectURL(url)
}
