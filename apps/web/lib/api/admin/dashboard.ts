import { apiFetch } from "@/lib/api"

export type AdminDashboard = {
  products: number
  orders: number
  inventoryItems: number
  categories: number
  customers: number
  salesPaise: number
  lowStockCount: number
  pendingOrdersCount: number
  openReturnsCount: number
}

export function getAdminDashboard(): Promise<AdminDashboard> {
  return apiFetch<AdminDashboard>("/admin/dashboard", { auth: "session" })
}
