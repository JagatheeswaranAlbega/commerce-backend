import { DuplicateResourceError, NotFoundError } from "@/shared/errors/app-error";
import type { Database } from "@/db/client";
import { ProductRepository } from "@/modules/product/product.repository";
import {
  toProductResponse,
  type CreateProductInput,
  type ListAdminProductsQuery,
  type ListCatalogProductsQuery,
  type ListStoreProductsQuery,
  type ProductResponse,
  type UpdateProductInput,
} from "@/modules/product/product.types";

export class ProductService {
  private readonly products: ProductRepository;

  constructor(db: Database) {
    this.products = new ProductRepository(db);
  }

  async listForStore(storeId: string, query: ListStoreProductsQuery) {
    const offset = (query.page - 1) * query.pageSize;
    const result = await this.products.listByStore(storeId, {
      limit: query.pageSize,
      offset,
      status: query.status,
      categoryId: query.categoryId,
      q: query.q,
    });
    return {
      items: result.items.map(toProductResponse),
      total: result.total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async listForPlatform(query: ListAdminProductsQuery) {
    const offset = (query.page - 1) * query.pageSize;
    const result = await this.products.listAll({
      limit: query.pageSize,
      offset,
      storeId: query.storeId,
      status: query.status,
    });
    return {
      items: result.items.map(toProductResponse),
      total: result.total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async listCatalog(storeId: string, query: ListCatalogProductsQuery) {
    const offset = (query.page - 1) * query.pageSize;
    const result = await this.products.listPublished(storeId, {
      limit: query.pageSize,
      offset,
      categoryId: query.categoryId,
      collectionId: query.collectionId,
      q: query.q,
      sort: query.sort,
      inStock: query.inStock,
      minPricePaise: query.minPricePaise,
      maxPricePaise: query.maxPricePaise,
    });
    return {
      items: result.items.map((item) => {
        const pricing = result.pricing.get(item.id);
        return {
          ...toProductResponse(item),
          minPricePaise: pricing?.minPricePaise ?? null,
          maxPricePaise: pricing?.maxPricePaise ?? null,
          compareAtPricePaise: pricing?.compareAtPricePaise ?? null,
          inStock: pricing?.inStock ?? false,
        };
      }),
      total: result.total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async getForStore(storeId: string, productId: string): Promise<ProductResponse> {
    const product = await this.products.findByStoreAndId(storeId, productId);
    if (!product) throw new NotFoundError("Product not found.");
    return toProductResponse(product);
  }

  async getCatalogByHandle(storeId: string, handle: string): Promise<ProductResponse> {
    const product = await this.products.findActiveByStoreAndHandle(storeId, handle);
    if (!product) throw new NotFoundError("Product not found.");
    return toProductResponse(product);
  }

  async create(storeId: string, input: CreateProductInput): Promise<ProductResponse> {
    const existing = await this.products.findByStoreAndHandle(storeId, input.handle);
    if (existing) throw new DuplicateResourceError("Product handle already exists.");
    const created = await this.products.create(storeId, input);
    return toProductResponse(created);
  }

  async update(
    storeId: string,
    productId: string,
    input: UpdateProductInput,
  ): Promise<ProductResponse> {
    if (input.handle) {
      const existing = await this.products.findByStoreAndHandle(storeId, input.handle);
      if (existing && existing.id !== productId) {
        throw new DuplicateResourceError("Product handle already exists.");
      }
    }
    const updated = await this.products.updateByStoreAndId(storeId, productId, input);
    if (!updated) throw new NotFoundError("Product not found.");
    return toProductResponse(updated);
  }

  async remove(storeId: string, productId: string): Promise<void> {
    const deleted = await this.products.deleteByStoreAndId(storeId, productId);
    if (!deleted) throw new NotFoundError("Product not found.");
  }
}

export type ProductServiceLike = ProductService;
