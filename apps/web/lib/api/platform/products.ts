import { apiFetchList, toQueryString, type PaginationMeta } from "@/lib/api"

export type PlatformProduct = {
  id: string
  storeId: string
  storeName?: string | null
  title?: string
  handle?: string
  name?: string
  slug?: string
  status: string
  createdAt: string
  updatedAt?: string
}

export function listPlatformProducts(input?: {
  page?: number
  pageSize?: number
  storeId?: string
  status?: string
}): Promise<{ data: PlatformProduct[]; pagination?: PaginationMeta }> {
  return apiFetchList<PlatformProduct[]>(
    `/platform/products${toQueryString({
      page: input?.page,
      pageSize: input?.pageSize,
      storeId: input?.storeId,
      status: input?.status,
    })}`,
    { auth: "session" }
  )
}
