import type { AdminCategory } from "@/lib/api/admin/categories"
import { listAdminCategories } from "@/lib/api/admin/categories"
import {
  createAdminProduct,
  createAdminVariant,
  deleteAdminProduct,
  deleteAdminProductMedia,
  deleteAdminVariant,
  getAdminProduct,
  setAdminProductMediaThumbnail,
  updateAdminProduct,
  updateAdminVariant,
  uploadAdminProductMedia,
  type AdminProduct,
  type AdminProductDetail,
  type AdminProductImage,
  type AdminVariant,
  type CreateProductInput,
  type CreateVariantInput,
  type UpdateProductInput,
  type UpdateVariantInput,
} from "@/lib/api/admin/products"
import {
  createPlatformStoreProduct,
  createPlatformStoreVariant,
  deletePlatformStoreProduct,
  deletePlatformStoreProductMedia,
  deletePlatformStoreVariant,
  getPlatformStoreProduct,
  listPlatformStoreCategories,
  setPlatformStoreProductMediaThumbnail,
  updatePlatformStoreProduct,
  updatePlatformStoreVariant,
  uploadPlatformStoreProductMedia,
} from "@/lib/api/platform/products"

export type StoreCatalogScope = {
  /** When set, Super Admin uses explicit platform store-scoped APIs. */
  storeId: string | null
}

export function storeCatalog(scope: StoreCatalogScope) {
  const storeId = scope.storeId

  return {
    getProduct(productId: string): Promise<AdminProductDetail> {
      return storeId
        ? getPlatformStoreProduct(storeId, productId)
        : getAdminProduct(productId)
    },
    createProduct(input: CreateProductInput): Promise<AdminProduct> {
      return storeId
        ? createPlatformStoreProduct(storeId, input)
        : createAdminProduct(input)
    },
    updateProduct(
      productId: string,
      input: UpdateProductInput
    ): Promise<AdminProduct> {
      return storeId
        ? updatePlatformStoreProduct(storeId, productId, input)
        : updateAdminProduct(productId, input)
    },
    deleteProduct(productId: string): Promise<void> {
      return storeId
        ? deletePlatformStoreProduct(storeId, productId)
        : deleteAdminProduct(productId)
    },
    createVariant(
      productId: string,
      input: CreateVariantInput
    ): Promise<AdminVariant> {
      return storeId
        ? createPlatformStoreVariant(storeId, productId, input)
        : createAdminVariant(productId, input)
    },
    updateVariant(
      productId: string,
      variantId: string,
      input: UpdateVariantInput
    ): Promise<AdminVariant> {
      return storeId
        ? updatePlatformStoreVariant(storeId, productId, variantId, input)
        : updateAdminVariant(productId, variantId, input)
    },
    deleteVariant(productId: string, variantId: string): Promise<void> {
      return storeId
        ? deletePlatformStoreVariant(storeId, productId, variantId)
        : deleteAdminVariant(productId, variantId)
    },
    uploadMedia(
      productId: string,
      file: File,
      altText?: string
    ): Promise<AdminProductImage> {
      return storeId
        ? uploadPlatformStoreProductMedia(storeId, productId, file, altText)
        : uploadAdminProductMedia(productId, file, altText)
    },
    deleteMedia(mediaId: string): Promise<void> {
      return storeId
        ? deletePlatformStoreProductMedia(storeId, mediaId)
        : deleteAdminProductMedia(mediaId)
    },
    setThumbnail(
      mediaId: string,
      isThumbnail = true
    ): Promise<AdminProductImage> {
      return storeId
        ? setPlatformStoreProductMediaThumbnail(storeId, mediaId, isThumbnail)
        : setAdminProductMediaThumbnail(mediaId, isThumbnail)
    },
    listCategories(): Promise<{ data: AdminCategory[] }> {
      if (!storeId) {
        return listAdminCategories({ pageSize: 100 })
      }
      return listPlatformStoreCategories(storeId).then((result) => ({
        data: result.data.map((category) => ({
          id: category.id,
          name: category.name,
          slug: category.slug,
          parentId: category.parentId,
          status: category.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
          createdAt: category.createdAt,
        })),
      }))
    },
  }
}

export function productFormHref(
  path: "/admin/products/create" | `/admin/products/${string}`,
  storeId?: string | null
) {
  if (!storeId) return path
  const separator = path.includes("?") ? "&" : "?"
  return `${path}${separator}storeId=${encodeURIComponent(storeId)}`
}

/** Store admin reads `/admin/media`. Super Admin must use the store-scoped platform route. */
export function productMediaPath(storeId?: string | null) {
  if (!storeId) return "/api/v1/admin/media"
  return `/api/v1/platform/stores/${storeId}/media`
}
