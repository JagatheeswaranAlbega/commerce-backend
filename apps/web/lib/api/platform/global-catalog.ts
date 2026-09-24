import { apiFetch, apiFetchList, toQueryString, type PaginationMeta } from "@/lib/api"

export type GlobalProductStatus = "DRAFT" | "ACTIVE" | "ARCHIVED"
export type GlobalCategoryStatus = "ACTIVE" | "INACTIVE"

export type GlobalCategory = {
  id: string
  name: string
  slug: string
  parentId: string | null
  status: GlobalCategoryStatus
  createdAt: string
  updatedAt: string
}

export type GlobalProduct = {
  id: string
  categoryId: string | null
  title: string
  handle: string
  shortDescription: string | null
  description: string | null
  status: GlobalProductStatus
  createdAt: string
  updatedAt: string
  imported?: boolean
  importCount?: number
  source?: "GLOBAL"
  thumbnail?: {
    id: string
    altText: string | null
    url: string | null
  } | null
}

export type GlobalVariant = {
  id: string
  productId: string
  sku: string
  title: string
  pricePaise: number
  compareAtPricePaise: number | null
  status: GlobalProductStatus
  createdAt: string
  updatedAt: string
}

export type GlobalProductImage = {
  id: string
  productId: string
  storageKey: string
  url: string | null
  altText: string | null
  sortOrder: number
  isThumbnail: boolean
  createdAt: string
  updatedAt: string
}

export type GlobalProductDetail = GlobalProduct & {
  variants: GlobalVariant[]
  images: GlobalProductImage[]
}

export async function listPlatformGlobalCategories(params?: {
  status?: GlobalCategoryStatus
}) {
  return apiFetch<GlobalCategory[]>(
    `/platform/global-categories${toQueryString(params ?? {})}`,
    { auth: "session" }
  )
}

export async function createPlatformGlobalCategory(input: {
  name: string
  slug: string
  parentId?: string | null
  status?: GlobalCategoryStatus
}) {
  return apiFetch<GlobalCategory>("/platform/global-categories", {
    method: "POST",
    auth: "session",
    body: JSON.stringify(input),
  })
}

export async function updatePlatformGlobalCategory(
  categoryId: string,
  input: Partial<{
    name: string
    slug: string
    parentId: string | null
    status: GlobalCategoryStatus
  }>
) {
  return apiFetch<GlobalCategory>(`/platform/global-categories/${categoryId}`, {
    method: "PATCH",
    auth: "session",
    body: JSON.stringify(input),
  })
}

export async function deletePlatformGlobalCategory(categoryId: string) {
  return apiFetch<{ id: string }>(`/platform/global-categories/${categoryId}`, {
    method: "DELETE",
    auth: "session",
  })
}

export async function listPlatformGlobalProducts(params?: {
  page?: number
  pageSize?: number
  status?: GlobalProductStatus
  categoryId?: string
  q?: string
}): Promise<{ data: GlobalProduct[]; pagination?: PaginationMeta }> {
  return apiFetchList<GlobalProduct[]>(
    `/platform/global-products${toQueryString(params ?? {})}`,
    { auth: "session" }
  )
}

export async function getPlatformGlobalProduct(productId: string) {
  return apiFetch<GlobalProductDetail>(`/platform/global-products/${productId}`, {
    auth: "session",
  })
}

export async function createPlatformGlobalProduct(input: {
  title: string
  handle: string
  shortDescription?: string | null
  description?: string | null
  status?: GlobalProductStatus
  categoryId?: string | null
}) {
  return apiFetch<GlobalProduct>("/platform/global-products", {
    method: "POST",
    auth: "session",
    body: JSON.stringify(input),
  })
}

export async function updatePlatformGlobalProduct(
  productId: string,
  input: Partial<{
    title: string
    handle: string
    shortDescription: string | null
    description: string | null
    status: GlobalProductStatus
    categoryId: string | null
  }>
) {
  return apiFetch<GlobalProduct>(`/platform/global-products/${productId}`, {
    method: "PATCH",
    auth: "session",
    body: JSON.stringify(input),
  })
}

export async function deletePlatformGlobalProduct(productId: string) {
  return apiFetch<{ id: string }>(`/platform/global-products/${productId}`, {
    method: "DELETE",
    auth: "session",
  })
}

export async function createPlatformGlobalVariant(
  productId: string,
  input: {
    sku: string
    title: string
    pricePaise: number
    compareAtPricePaise?: number | null
    status?: GlobalProductStatus
  }
) {
  return apiFetch<GlobalVariant>(`/platform/global-products/${productId}/variants`, {
    method: "POST",
    auth: "session",
    body: JSON.stringify(input),
  })
}

export async function updatePlatformGlobalVariant(
  productId: string,
  variantId: string,
  input: Partial<{
    sku: string
    title: string
    pricePaise: number
    compareAtPricePaise: number | null
    status: GlobalProductStatus
  }>
) {
  return apiFetch<GlobalVariant>(
    `/platform/global-products/${productId}/variants/${variantId}`,
    {
      method: "PATCH",
      auth: "session",
      body: JSON.stringify(input),
    }
  )
}

export async function deletePlatformGlobalVariant(productId: string, variantId: string) {
  return apiFetch<{ id: string }>(
    `/platform/global-products/${productId}/variants/${variantId}`,
    {
      method: "DELETE",
      auth: "session",
    }
  )
}

export function uploadPlatformGlobalProductMedia(
  productId: string,
  file: File,
  altText?: string
): Promise<GlobalProductImage> {
  const body = new FormData()
  body.append("productId", productId)
  body.append("file", file)
  if (altText) body.append("altText", altText)
  return apiFetch<GlobalProductImage>("/platform/global-media/upload", {
    method: "POST",
    auth: "session",
    body,
  })
}

export function deletePlatformGlobalProductMedia(mediaId: string): Promise<void> {
  return apiFetch<void>(`/platform/global-media/${mediaId}`, {
    method: "DELETE",
    auth: "session",
  })
}

export function setPlatformGlobalProductMediaThumbnail(
  productId: string,
  mediaId: string,
  isThumbnail = true
): Promise<GlobalProductImage> {
  return apiFetch<GlobalProductImage>(`/platform/global-media/${mediaId}/thumbnail`, {
    method: "POST",
    auth: "session",
    body: JSON.stringify({ productId, isThumbnail }),
  })
}
