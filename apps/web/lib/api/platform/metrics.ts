import { apiFetch } from "@/lib/api"

export type PlatformMetrics = {
  storeCount: number
  adminCount: number
  productCount: number
  orderCount: number
  salesPaise?: number
}

export function getPlatformMetrics(): Promise<PlatformMetrics> {
  return apiFetch<PlatformMetrics>("/platform/metrics", { auth: "session" })
}
