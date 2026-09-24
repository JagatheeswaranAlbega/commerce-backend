import {
  AppError,
  ConflictError,
  DuplicateResourceError,
  NotFoundError,
  ValidationError,
} from "@/shared/errors/app-error";
import type { Database } from "@/db/client";
import { GlobalCatalogRepository } from "./global-catalog.repository";
import {
  toGlobalCategoryResponse,
  toGlobalImageResponse,
  toGlobalProductResponse,
  toGlobalVariantResponse,
  type CreateGlobalCategoryInput,
  type CreateGlobalProductInput,
  type CreateGlobalVariantInput,
  type GlobalCategoryResponse,
  type GlobalImageResponse,
  type GlobalProductResponse,
  type GlobalProductThumbnail,
  type GlobalVariantResponse,
  type ListGlobalProductsQuery,
  type UpdateGlobalCategoryInput,
  type UpdateGlobalProductInput,
  type UpdateGlobalVariantInput,
} from "./global-catalog.types";

export type BulkImportFailure = {
  productId: string;
  message: string;
  code: string | null;
};

export type BulkImportResult = {
  imported: Array<
    GlobalProductResponse & { associationId: string; importedAt: string }
  >;
  failed: BulkImportFailure[];
  importedCount: number;
  failedCount: number;
};

export class GlobalCatalogService {
  private readonly repo: GlobalCatalogRepository;

  constructor(db: Database) {
    this.repo = new GlobalCatalogRepository(db);
  }

  // --- Categories ---

  async listCategories(status?: "ACTIVE" | "INACTIVE"): Promise<GlobalCategoryResponse[]> {
    const items = await this.repo.listCategories(status);
    return items.map(toGlobalCategoryResponse);
  }

  async getCategory(categoryId: string): Promise<GlobalCategoryResponse> {
    const category = await this.repo.findCategoryById(categoryId);
    if (!category) throw new NotFoundError("Global category not found.");
    return toGlobalCategoryResponse(category);
  }

  async createCategory(input: CreateGlobalCategoryInput): Promise<GlobalCategoryResponse> {
    const existing = await this.repo.findCategoryBySlug(input.slug);
    if (existing) throw new DuplicateResourceError("Global category slug already exists.");
    if (input.parentId) {
      const parent = await this.repo.findCategoryById(input.parentId);
      if (!parent) throw new ValidationError("Parent category not found.");
    }
    const created = await this.repo.createCategory(input);
    return toGlobalCategoryResponse(created);
  }

  async updateCategory(
    categoryId: string,
    input: UpdateGlobalCategoryInput,
  ): Promise<GlobalCategoryResponse> {
    if (input.slug) {
      const existing = await this.repo.findCategoryBySlug(input.slug);
      if (existing && existing.id !== categoryId) {
        throw new DuplicateResourceError("Global category slug already exists.");
      }
    }
    if (input.parentId) {
      if (input.parentId === categoryId) {
        throw new ValidationError("Category cannot be its own parent.");
      }
      const parent = await this.repo.findCategoryById(input.parentId);
      if (!parent) throw new ValidationError("Parent category not found.");
    }
    const updated = await this.repo.updateCategory(categoryId, input);
    if (!updated) throw new NotFoundError("Global category not found.");
    return toGlobalCategoryResponse(updated);
  }

  async removeCategory(categoryId: string): Promise<void> {
    const deleted = await this.repo.deleteCategory(categoryId);
    if (!deleted) throw new NotFoundError("Global category not found.");
  }

  // --- Products ---

  async listProducts(query: ListGlobalProductsQuery, storeId?: string) {
    if (storeId) {
      const result = await this.repo.filterProductsByImport(storeId, query);
      const thumbnails = await this.thumbnailsForProducts(result.items.map((p) => p.id));
      return {
        items: result.items.map((p) =>
          toGlobalProductResponse(p, {
            imported: result.importedIds.has(p.id),
            thumbnail: thumbnails.get(p.id) ?? null,
          }),
        ),
        total: result.total,
        page: query.page,
        pageSize: query.pageSize,
      };
    }

    const offset = (query.page - 1) * query.pageSize;
    const result = await this.repo.listProducts({
      limit: query.pageSize,
      offset,
      status: query.status,
      categoryId: query.categoryId,
      q: query.q,
    });
    const productIds = result.items.map((p) => p.id);
    const [importCounts, thumbnails] = await Promise.all([
      this.repo.countImportsByProductIds(productIds),
      this.thumbnailsForProducts(productIds),
    ]);
    return {
      items: result.items.map((p) =>
        toGlobalProductResponse(p, {
          importCount: importCounts.get(p.id) ?? 0,
          thumbnail: thumbnails.get(p.id) ?? null,
        }),
      ),
      total: result.total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async getProduct(
    productId: string,
    storeId?: string,
  ): Promise<GlobalProductResponse & { variants: GlobalVariantResponse[]; images: GlobalImageResponse[] }> {
    const product = await this.repo.findProductById(productId);
    if (!product) throw new NotFoundError("Global product not found.");
    const [variants, images, association, importCounts] = await Promise.all([
      this.repo.listVariantsByProduct(productId),
      this.repo.listImagesByProduct(productId),
      storeId ? this.repo.findAssociation(storeId, productId) : Promise.resolve(null),
      storeId
        ? Promise.resolve(new Map<string, number>())
        : this.repo.countImportsByProductIds([productId]),
    ]);
    return {
      ...toGlobalProductResponse(product, {
        ...(storeId ? { imported: Boolean(association) } : {}),
        ...(!storeId ? { importCount: importCounts.get(productId) ?? 0 } : {}),
      }),
      variants: variants.map(toGlobalVariantResponse),
      images: images.map(toGlobalImageResponse),
    };
  }

  async createProduct(input: CreateGlobalProductInput): Promise<GlobalProductResponse> {
    const existing = await this.repo.findProductByHandle(input.handle);
    if (existing) throw new DuplicateResourceError("Global product handle already exists.");
    if (input.categoryId) {
      const category = await this.repo.findCategoryById(input.categoryId);
      if (!category) throw new ValidationError("Global category not found.");
    }
    const created = await this.repo.createProduct(input);
    return toGlobalProductResponse(created, { importCount: 0 });
  }

  async updateProduct(
    productId: string,
    input: UpdateGlobalProductInput,
  ): Promise<GlobalProductResponse> {
    if (input.handle) {
      const existing = await this.repo.findProductByHandle(input.handle);
      if (existing && existing.id !== productId) {
        throw new DuplicateResourceError("Global product handle already exists.");
      }
    }
    if (input.categoryId) {
      const category = await this.repo.findCategoryById(input.categoryId);
      if (!category) throw new ValidationError("Global category not found.");
    }
    const updated = await this.repo.updateProduct(productId, input);
    if (!updated) throw new NotFoundError("Global product not found.");
    const importCounts = await this.repo.countImportsByProductIds([productId]);
    return toGlobalProductResponse(updated, {
      importCount: importCounts.get(productId) ?? 0,
    });
  }

  async removeProduct(productId: string): Promise<void> {
    const deleted = await this.repo.deleteProduct(productId);
    if (!deleted) throw new NotFoundError("Global product not found.");
  }

  // --- Variants ---

  async listVariants(productId: string): Promise<GlobalVariantResponse[]> {
    const product = await this.repo.findProductById(productId);
    if (!product) throw new NotFoundError("Global product not found.");
    const variants = await this.repo.listVariantsByProduct(productId);
    return variants.map(toGlobalVariantResponse);
  }

  async createVariant(
    productId: string,
    input: CreateGlobalVariantInput,
  ): Promise<GlobalVariantResponse> {
    const product = await this.repo.findProductById(productId);
    if (!product) throw new NotFoundError("Global product not found.");
    const existing = await this.repo.findVariantBySku(input.sku);
    if (existing) throw new DuplicateResourceError("Global variant SKU already exists.");
    const created = await this.repo.createVariant(productId, input);
    return toGlobalVariantResponse(created);
  }

  async updateVariant(
    productId: string,
    variantId: string,
    input: UpdateGlobalVariantInput,
  ): Promise<GlobalVariantResponse> {
    if (input.sku) {
      const existing = await this.repo.findVariantBySku(input.sku);
      if (existing && existing.id !== variantId) {
        throw new DuplicateResourceError("Global variant SKU already exists.");
      }
    }
    const updated = await this.repo.updateVariant(productId, variantId, input);
    if (!updated) throw new NotFoundError("Global variant not found.");
    return toGlobalVariantResponse(updated);
  }

  async removeVariant(productId: string, variantId: string): Promise<void> {
    const deleted = await this.repo.deleteVariant(productId, variantId);
    if (!deleted) throw new NotFoundError("Global variant not found.");
  }

  // --- Images ---

  async thumbnailsForProducts(productIds: string[]) {
    const map = new Map<string, GlobalProductThumbnail>();
    if (productIds.length === 0) return map;
    const images = await this.repo.listImagesByProductIds(productIds);
    const byProduct = new Map<string, typeof images>();
    for (const image of images) {
      const list = byProduct.get(image.productId) ?? [];
      list.push(image);
      byProduct.set(image.productId, list);
    }
    for (const [productId, list] of byProduct) {
      const thumb =
        list.find((image) => image.isThumbnail) ??
        [...list].sort((a, b) => a.sortOrder - b.sortOrder)[0];
      if (thumb) {
        map.set(productId, {
          id: thumb.id,
          altText: thumb.altText,
          url: thumb.url,
        });
      }
    }
    return map;
  }

  async listImages(productId: string): Promise<GlobalImageResponse[]> {
    const product = await this.repo.findProductById(productId);
    if (!product) throw new NotFoundError("Global product not found.");
    const images = await this.repo.listImagesByProduct(productId);
    return images.map(toGlobalImageResponse);
  }

  async createImage(
    productId: string,
    input: {
      storageKey: string;
      url?: string | null;
      altText?: string | null;
      sortOrder?: number;
      isThumbnail?: boolean;
    },
  ): Promise<GlobalImageResponse> {
    const product = await this.repo.findProductById(productId);
    if (!product) throw new NotFoundError("Global product not found.");
    const created = await this.repo.createImage({ productId, ...input });
    return toGlobalImageResponse(created);
  }

  async setThumbnail(
    productId: string,
    imageId: string,
    isThumbnail = true,
  ): Promise<GlobalImageResponse> {
    const updated = await this.repo.setImageThumbnail(productId, imageId, isThumbnail);
    if (!updated) throw new NotFoundError("Global product image not found.");
    return toGlobalImageResponse(updated);
  }

  async removeImage(imageId: string): Promise<GlobalImageResponse> {
    const deleted = await this.repo.deleteImage(imageId);
    if (!deleted) throw new NotFoundError("Global product image not found.");
    return toGlobalImageResponse(deleted);
  }

  // --- Import / remove ---

  async importToStore(storeId: string, globalProductId: string) {
    const product = await this.repo.findProductById(globalProductId);
    if (!product) throw new NotFoundError("Global product not found.");
    if (product.status !== "ACTIVE") {
      throw new ValidationError("Only ACTIVE global products can be imported.");
    }

    const existing = await this.repo.findAssociation(storeId, globalProductId);
    if (existing) {
      throw new ConflictError("Global product is already imported into this store.", {
        code: "GLOBAL_PRODUCT_ALREADY_IMPORTED",
      });
    }

    const localHandle = await this.repo.findLocalProductByHandle(storeId, product.handle);
    if (localHandle) {
      throw new ConflictError(
        "A local product with the same handle already exists in this store.",
        { code: "HANDLE_CONFLICT" },
      );
    }

    const variants = await this.repo.listVariantsByProduct(globalProductId);
    const activeVariants = variants.filter((v) => v.status === "ACTIVE");
    if (activeVariants.length === 0) {
      throw new ValidationError("Global product must have at least one ACTIVE variant.");
    }

    const association = await this.repo.importProduct(
      storeId,
      globalProductId,
      variants.map((v) => v.id),
    );

    return {
      ...toGlobalProductResponse(product, { imported: true }),
      associationId: association.id,
      importedAt: association.importedAt.toISOString(),
    };
  }

  async importManyToStore(storeId: string, productIds: string[]): Promise<BulkImportResult> {
    const uniqueIds = [...new Set(productIds)];
    const imported: BulkImportResult["imported"] = [];
    const failed: BulkImportFailure[] = [];

    for (const productId of uniqueIds) {
      try {
        imported.push(await this.importToStore(storeId, productId));
      } catch (error) {
        if (error instanceof AppError) {
          failed.push({
            productId,
            message: error.message,
            code: error.code,
          });
        } else {
          failed.push({
            productId,
            message: "Import failed.",
            code: null,
          });
        }
      }
    }

    return {
      imported,
      failed,
      importedCount: imported.length,
      failedCount: failed.length,
    };
  }

  async removeFromStore(storeId: string, globalProductId: string): Promise<void> {
    const deleted = await this.repo.removeImport(storeId, globalProductId);
    if (!deleted) throw new NotFoundError("Global product is not imported into this store.");
  }
}

export type GlobalCatalogServiceLike = GlobalCatalogService;
