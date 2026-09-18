import { apiFetch, toQueryString, type PaginationMeta } from "@/lib/api"
import { getAccessToken } from "@/lib/auth-cookie"

export type SalesReportSummary = {
  orderCount: number
  salesPaise: number
  averageOrderPaise: number
}

export type SalesReportDaily = {
  date: string
  orderCount: number
  salesPaise: number
}

export type SalesReportOrder = {
  id: string
  orderNumber: string
  status: string
  createdAt: string
  subtotalPaise: number
  discountTotalPaise: number
  taxTotalPaise: number
  shippingTotalPaise: number
  grandTotalPaise: number
  discountCode: string | null
  customerId: string | null
  customerEmail: string | null
}

export type SalesReport = {
  from: string
  to: string
  summary: SalesReportSummary
  daily: SalesReportDaily[]
  orders: SalesReportOrder[]
  pagination?: PaginationMeta
  storeId?: string
  storeName?: string
}

function getApiBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL?.trim()
  if (!baseUrl) throw new Error("API URL is not configured.")
  return baseUrl.replace(/\/$/, "")
}

export function getAdminSalesReport(input?: {
  from?: string
  to?: string
  page?: number
  pageSize?: number
}): Promise<SalesReport> {
  return apiFetch<SalesReport>(
    `/admin/reports/sales${toQueryString({
      from: input?.from,
      to: input?.to,
      page: input?.page,
      pageSize: input?.pageSize,
    })}`,
    { auth: "session" }
  )
}

export async function downloadAdminSalesCsv(input?: {
  from?: string
  to?: string
}): Promise<void> {
  const token = getAccessToken()
  const response = await fetch(
    `${getApiBaseUrl()}/api/v1/admin/reports/sales/export${toQueryString({
      from: input?.from,
      to: input?.to,
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
