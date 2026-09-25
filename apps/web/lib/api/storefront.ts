import {
  apiFetch,
  apiFetchList,
  toQueryString,
  type PaginationMeta,
} from "@/lib/api"

const STOREFRONT = { auth: "publishable" as const, silent: true }

export type StorefrontStore = {
  id: string
  name: string
  slug: string
  status: string
  currency: string
}

export type StorefrontCategory = {
  id: string
  storeId: string
  name: string
  slug: string
  parentId: string | null
  status: "ACTIVE" | "INACTIVE"
}

export type StorefrontProduct = {
  id: string
  storeId: string
  categoryId: string | null
  title: string
  handle: string
  shortDescription: string | null
  description: string | null
  status: string
  minPricePaise: number | null
  maxPricePaise: number | null
  compareAtPricePaise: number | null
  inStock: boolean
  thumbnail?: {
    id: string
    altText: string | null
    src: string
  } | null
}

export type StorefrontProductDetail = StorefrontProduct & {
  variants: Array<{
    id: string
    productId: string
    sku: string
    title: string
    pricePaise: number
    compareAtPricePaise: number | null
    availableQuantity: number
  }>
  images: Array<{
    id: string
    altText: string | null
    src: string
  }>
}

export type StorefrontCategoryDetail = StorefrontCategory & {
  products: StorefrontProduct[]
}

export function getStorefrontStore() {
  return apiFetch<StorefrontStore>("/store/details", STOREFRONT)
}

export function listStorefrontCategories() {
  return apiFetch<StorefrontCategory[]>("/store/categories", STOREFRONT)
}

export function getStorefrontCategory(slug: string) {
  return apiFetch<StorefrontCategoryDetail>(
    `/store/categories/${encodeURIComponent(slug)}`,
    STOREFRONT
  )
}

export function listStorefrontProducts(params?: {
  page?: number
  pageSize?: number
  categoryId?: string
  q?: string
  sort?: "created_at_desc" | "price_asc" | "price_desc"
}): Promise<{ data: StorefrontProduct[]; pagination?: PaginationMeta }> {
  return apiFetchList<StorefrontProduct[]>(
    `/store/products${toQueryString({
      page: params?.page,
      pageSize: params?.pageSize,
      categoryId: params?.categoryId,
      q: params?.q,
      sort: params?.sort,
    })}`,
    STOREFRONT
  )
}

export function getStorefrontProduct(handle: string) {
  return apiFetch<StorefrontProductDetail>(
    `/store/products/${encodeURIComponent(handle)}`,
    STOREFRONT
  )
}

export function storefrontMediaSrc(mediaId: string) {
  return `/shop/media/${encodeURIComponent(mediaId)}`
}
