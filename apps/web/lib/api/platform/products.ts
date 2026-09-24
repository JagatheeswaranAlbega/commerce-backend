import { apiFetch, apiFetchList, toQueryString, type PaginationMeta } from "@/lib/api"
import type {
  AdminProduct,
  AdminProductDetail,
  AdminProductImage,
  AdminVariant,
  CreateProductInput,
  CreateVariantInput,
  UpdateProductInput,
  UpdateVariantInput,
} from "@/lib/api/admin/products"

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

function storeCatalogBase(storeId: string) {
  return `/platform/stores/${storeId}`
}

export function getPlatformStoreProduct(
  storeId: string,
  productId: string
): Promise<AdminProductDetail> {
  return apiFetch<AdminProductDetail>(
    `${storeCatalogBase(storeId)}/products/${productId}`,
    { auth: "session" }
  )
}

export function createPlatformStoreProduct(
  storeId: string,
  input: CreateProductInput
): Promise<AdminProduct> {
  return apiFetch<AdminProduct>(`${storeCatalogBase(storeId)}/products`, {
    method: "POST",
    auth: "session",
    body: JSON.stringify(input),
  })
}

export function updatePlatformStoreProduct(
  storeId: string,
  productId: string,
  input: UpdateProductInput
): Promise<AdminProduct> {
  return apiFetch<AdminProduct>(
    `${storeCatalogBase(storeId)}/products/${productId}`,
    {
      method: "PATCH",
      auth: "session",
      body: JSON.stringify(input),
    }
  )
}

export function deletePlatformStoreProduct(
  storeId: string,
  productId: string
): Promise<void> {
  return apiFetch<void>(`${storeCatalogBase(storeId)}/products/${productId}`, {
    method: "DELETE",
    auth: "session",
  })
}

export function createPlatformStoreVariant(
  storeId: string,
  productId: string,
  input: CreateVariantInput
): Promise<AdminVariant> {
  return apiFetch<AdminVariant>(
    `${storeCatalogBase(storeId)}/products/${productId}/variants`,
    {
      method: "POST",
      auth: "session",
      body: JSON.stringify(input),
    }
  )
}

export function updatePlatformStoreVariant(
  storeId: string,
  productId: string,
  variantId: string,
  input: UpdateVariantInput
): Promise<AdminVariant> {
  return apiFetch<AdminVariant>(
    `${storeCatalogBase(storeId)}/products/${productId}/variants/${variantId}`,
    {
      method: "PATCH",
      auth: "session",
      body: JSON.stringify(input),
    }
  )
}

export function deletePlatformStoreVariant(
  storeId: string,
  productId: string,
  variantId: string
): Promise<void> {
  return apiFetch<void>(
    `${storeCatalogBase(storeId)}/products/${productId}/variants/${variantId}`,
    {
      method: "DELETE",
      auth: "session",
    }
  )
}

export function uploadPlatformStoreProductMedia(
  storeId: string,
  productId: string,
  file: File,
  altText?: string
): Promise<AdminProductImage> {
  const body = new FormData()
  body.append("productId", productId)
  body.append("file", file)
  if (altText) body.append("altText", altText)
  return apiFetch<AdminProductImage>(`${storeCatalogBase(storeId)}/media/upload`, {
    method: "POST",
    auth: "session",
    body,
  })
}

export function deletePlatformStoreProductMedia(
  storeId: string,
  mediaId: string
): Promise<void> {
  return apiFetch<void>(`${storeCatalogBase(storeId)}/media/${mediaId}`, {
    method: "DELETE",
    auth: "session",
  })
}

export function setPlatformStoreProductMediaThumbnail(
  storeId: string,
  mediaId: string,
  isThumbnail = true
): Promise<AdminProductImage> {
  return apiFetch<AdminProductImage>(
    `${storeCatalogBase(storeId)}/media/${mediaId}/thumbnail`,
    {
      method: "POST",
      auth: "session",
      body: JSON.stringify({ isThumbnail }),
    }
  )
}

export function listPlatformStoreCategories(storeId: string): Promise<{
  data: Array<{
    id: string
    name: string
    slug: string
    parentId: string | null
    status: string
    createdAt: string
  }>
  pagination?: PaginationMeta
}> {
  return apiFetchList(`${storeCatalogBase(storeId)}/categories`, {
    auth: "session",
  })
}
