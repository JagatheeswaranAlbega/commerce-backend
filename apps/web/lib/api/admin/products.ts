import { apiFetch, apiFetchList, toQueryString, type PaginationMeta } from "@/lib/api"

export type ProductStatus = "DRAFT" | "ACTIVE" | "ARCHIVED"

export type AdminProduct = {
  id: string
  storeId: string
  title: string
  handle: string
  status: ProductStatus
  shortDescription?: string | null
  description?: string | null
  categoryId?: string | null
  createdAt: string
  updatedAt?: string
  thumbnail?: {
    id: string
    altText: string | null
    url: string | null
  } | null
}

export type AdminVariant = {
  id: string
  storeId: string
  productId: string
  sku: string
  title: string
  pricePaise: number
  compareAtPricePaise: number | null
  status: ProductStatus
  createdAt: string
  updatedAt: string
}

export type AdminProductImage = {
  id: string
  storeId: string
  productId: string
  storageKey: string
  url: string | null
  altText: string | null
  sortOrder: number
  isThumbnail: boolean
}

export type AdminProductDetail = AdminProduct & {
  variants: AdminVariant[]
  images: AdminProductImage[]
}

export type CreateProductInput = {
  title: string
  handle: string
  status?: ProductStatus
  shortDescription?: string
  description?: string
  categoryId?: string | null
}

export type UpdateProductInput = {
  title?: string
  handle?: string
  status?: ProductStatus
  shortDescription?: string | null
  description?: string | null
  categoryId?: string | null
}

export type CreateVariantInput = {
  sku: string
  title: string
  pricePaise: number
  compareAtPricePaise?: number | null
  status?: ProductStatus
  /** On-hand quantity to seed when creating the variant (admin create only). */
  initialQuantity?: number
}

export type UpdateVariantInput = Partial<CreateVariantInput>

export function listAdminProducts(input?: {
  page?: number
  pageSize?: number
  status?: ProductStatus
  categoryId?: string
  q?: string
}): Promise<{ data: AdminProduct[]; pagination?: PaginationMeta }> {
  return apiFetchList<AdminProduct[]>(
    `/admin/products${toQueryString({
      page: input?.page,
      pageSize: input?.pageSize,
      status: input?.status,
      categoryId: input?.categoryId,
      q: input?.q,
    })}`,
    { auth: "session" }
  )
}

export function getAdminProduct(productId: string): Promise<AdminProductDetail> {
  return apiFetch<AdminProductDetail>(`/admin/products/${productId}`, {
    auth: "session",
  })
}

export function createAdminProduct(
  input: CreateProductInput
): Promise<AdminProduct> {
  return apiFetch<AdminProduct>("/admin/products", {
    method: "POST",
    auth: "session",
    body: JSON.stringify(input),
  })
}

export function updateAdminProduct(
  productId: string,
  input: UpdateProductInput
): Promise<AdminProduct> {
  return apiFetch<AdminProduct>(`/admin/products/${productId}`, {
    method: "PATCH",
    auth: "session",
    body: JSON.stringify(input),
  })
}

export function deleteAdminProduct(productId: string): Promise<void> {
  return apiFetch<void>(`/admin/products/${productId}`, {
    method: "DELETE",
    auth: "session",
  })
}

export function createAdminVariant(
  productId: string,
  input: CreateVariantInput
): Promise<AdminVariant> {
  return apiFetch<AdminVariant>(`/admin/products/${productId}/variants`, {
    method: "POST",
    auth: "session",
    body: JSON.stringify(input),
  })
}

export function updateAdminVariant(
  productId: string,
  variantId: string,
  input: UpdateVariantInput
): Promise<AdminVariant> {
  return apiFetch<AdminVariant>(
    `/admin/products/${productId}/variants/${variantId}`,
    {
      method: "PATCH",
      auth: "session",
      body: JSON.stringify(input),
    }
  )
}

export function deleteAdminVariant(
  productId: string,
  variantId: string
): Promise<void> {
  return apiFetch<void>(
    `/admin/products/${productId}/variants/${variantId}`,
    {
      method: "DELETE",
      auth: "session",
    }
  )
}

export function uploadAdminProductMedia(
  productId: string,
  file: File,
  altText?: string
): Promise<AdminProductImage> {
  const body = new FormData()
  body.append("productId", productId)
  body.append("file", file)
  if (altText) body.append("altText", altText)
  return apiFetch<AdminProductImage>("/admin/media/upload", {
    method: "POST",
    auth: "session",
    body,
  })
}

export function deleteAdminProductMedia(mediaId: string): Promise<void> {
  return apiFetch<void>(`/admin/media/${mediaId}`, {
    method: "DELETE",
    auth: "session",
  })
}

export function setAdminProductMediaThumbnail(
  mediaId: string,
  isThumbnail = true
): Promise<AdminProductImage> {
  return apiFetch<AdminProductImage>(`/admin/media/${mediaId}/thumbnail`, {
    method: "POST",
    auth: "session",
    body: JSON.stringify({ isThumbnail }),
  })
}

export function updateAdminProductMedia(
  mediaId: string,
  input: {
    altText?: string | null
    sortOrder?: number
    swapWithMediaId?: string
  }
): Promise<AdminProductImage> {
  return apiFetch<AdminProductImage>(`/admin/media/${mediaId}`, {
    method: "PATCH",
    auth: "session",
    body: JSON.stringify(input),
  })
}
