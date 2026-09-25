import { and, eq, inArray } from "drizzle-orm";
import { DuplicateResourceError, NotFoundError } from "@/shared/errors/app-error";
import type { Database } from "@/db/client";
import { globalProductImages } from "@/db/schema/global-product-images";
import { globalProductVariants } from "@/db/schema/global-product-variants";
import { inventory } from "@/db/schema/inventory";
import { GlobalCatalogRepository } from "@/modules/global-catalog/global-catalog.repository";
import { ProductRepository } from "@/modules/product/product.repository";
import {
  toProductResponse,
  type CatalogProductResponse,
  type CreateProductInput,
  type ListAdminProductsQuery,
  type ListCatalogProductsQuery,
  type ListStoreProductsQuery,
  type ProductResponse,
  type UpdateProductInput,
} from "@/modules/product/product.types";

export class ProductService {
  private readonly products: ProductRepository;
  private readonly globals: GlobalCatalogRepository;
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
    this.products = new ProductRepository(db);
    this.globals = new GlobalCatalogRepository(db);
  }

  async listForStore(storeId: string, query: ListStoreProductsQuery) {
    const offset = (query.page - 1) * query.pageSize;

    const local = await this.products.listByStore(storeId, {
      limit: 500,
      offset: 0,
      status: query.status,
      categoryId: query.categoryId,
      q: query.q,
    });

    const importedIds = await this.globals.listImportedProductIds(
      storeId,
      query.categoryId ? { storeCategoryId: query.categoryId } : undefined,
    );
    const categoryMap = await this.globals.listImportedCategoryMap(storeId);
    let globalItems: Awaited<ReturnType<GlobalCatalogRepository["listProducts"]>>["items"] = [];
    if (importedIds.size > 0) {
      const listed = await this.globals.listProducts({
        limit: 500,
        offset: 0,
        status: query.status,
        q: query.q,
      });
      globalItems = listed.items.filter((p) => importedIds.has(p.id));
    }

    const localItems: ProductResponse[] = local.items.map((item) => ({
      ...toProductResponse(item),
      source: "STORE" as const,
      platformManaged: false,
    }));

    const globalResponses: ProductResponse[] = globalItems.map((product) => ({
      id: product.id,
      storeId,
      categoryId: categoryMap.get(product.id) ?? null,
      title: product.title,
      handle: product.handle,
      shortDescription: product.shortDescription,
      description: product.description,
      status: product.status,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      source: "GLOBAL" as const,
      platformManaged: true,
    }));

    const merged = [...localItems, ...globalResponses].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const filtered =
      query.source === "STORE"
        ? merged.filter((item) => item.source !== "GLOBAL")
        : query.source === "GLOBAL"
          ? merged.filter((item) => item.source === "GLOBAL")
          : merged;
    const total = filtered.length;
    return {
      items: filtered.slice(offset, offset + query.pageSize),
      total,
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
    // Collection filter only applies to local products.
    if (query.collectionId) {
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
            source: "STORE" as const,
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

    const local = await this.products.listPublished(storeId, {
      limit: 500,
      offset: 0,
      categoryId: query.categoryId,
      q: query.q,
      sort: query.sort,
      inStock: query.inStock,
      minPricePaise: query.minPricePaise,
      maxPricePaise: query.maxPricePaise,
    });

    const imported = await this.globals.listImportedActiveProducts(storeId, {
      limit: 500,
      offset: 0,
      categoryId: query.categoryId,
      q: query.q,
    });

    const globalItems: CatalogProductResponse[] = [];
    if (imported.items.length > 0) {
      const productIds = imported.items.map((p) => p.id);
      const variantRows = await this.db
        .select({
          productId: globalProductVariants.productId,
          pricePaise: globalProductVariants.pricePaise,
          compareAtPricePaise: globalProductVariants.compareAtPricePaise,
          variantId: globalProductVariants.id,
        })
        .from(globalProductVariants)
        .where(
          and(
            eq(globalProductVariants.status, "ACTIVE"),
            inArray(globalProductVariants.productId, productIds),
          ),
        );
      const variantIds = variantRows.map((v) => v.variantId);
      const stockRows =
        variantIds.length === 0
          ? []
          : await this.db
              .select({
                variantId: inventory.variantId,
                availableQuantity: inventory.availableQuantity,
              })
              .from(inventory)
              .where(and(eq(inventory.storeId, storeId), inArray(inventory.variantId, variantIds)));
      const stockByVariant = new Map(stockRows.map((r) => [r.variantId, r.availableQuantity]));

      for (const product of imported.items) {
        const variants = variantRows.filter((v) => v.productId === product.id);
        if (variants.length === 0) continue;
        const prices = variants.map((v) => v.pricePaise);
        const minPricePaise = Math.min(...prices);
        const maxPricePaise = Math.max(...prices);
        const cheapest = variants.reduce((best, row) =>
          row.pricePaise < best.pricePaise ? row : best,
        );
        const inStock = variants.some((row) => (stockByVariant.get(row.variantId) ?? 0) > 0);
        if (query.inStock === true && !inStock) continue;
        if (query.inStock === false && inStock) continue;
        if (query.minPricePaise !== undefined && minPricePaise < query.minPricePaise) continue;
        if (query.maxPricePaise !== undefined && maxPricePaise > query.maxPricePaise) continue;

        globalItems.push({
          id: product.id,
          storeId,
          categoryId: product.storeCategoryId,
          title: product.title,
          handle: product.handle,
          shortDescription: product.shortDescription,
          description: product.description,
          status: product.status,
          createdAt: product.createdAt.toISOString(),
          updatedAt: product.updatedAt.toISOString(),
          source: "GLOBAL",
          minPricePaise,
          maxPricePaise,
          compareAtPricePaise: cheapest.compareAtPricePaise,
          inStock,
        });
      }
    }

    const localItems: CatalogProductResponse[] = local.items.map((item) => {
      const pricing = local.pricing.get(item.id);
      return {
        ...toProductResponse(item),
        source: "STORE" as const,
        minPricePaise: pricing?.minPricePaise ?? null,
        maxPricePaise: pricing?.maxPricePaise ?? null,
        compareAtPricePaise: pricing?.compareAtPricePaise ?? null,
        inStock: pricing?.inStock ?? false,
      };
    });

    const merged = [...localItems, ...globalItems];
    if (query.sort === "price_asc") {
      merged.sort((a, b) => (a.minPricePaise ?? 0) - (b.minPricePaise ?? 0));
    } else if (query.sort === "price_desc") {
      merged.sort((a, b) => (b.minPricePaise ?? 0) - (a.minPricePaise ?? 0));
    } else {
      merged.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }

    const total = merged.length;
    const pageItems = merged.slice(offset, offset + query.pageSize);
    return {
      items: pageItems,
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async getForStore(
    storeId: string,
    productId: string,
  ): Promise<ProductResponse> {
    const product = await this.products.findByStoreAndId(storeId, productId);
    if (product) {
      return {
        ...toProductResponse(product),
        source: "STORE",
        platformManaged: false,
      };
    }

    const association = await this.globals.findAssociation(storeId, productId);
    if (!association) throw new NotFoundError("Product not found.");
    const global = await this.globals.findProductById(productId);
    if (!global) throw new NotFoundError("Product not found.");
    return {
      id: global.id,
      storeId,
      categoryId: association.storeCategoryId,
      title: global.title,
      handle: global.handle,
      shortDescription: global.shortDescription,
      description: global.description,
      status: global.status,
      createdAt: global.createdAt.toISOString(),
      updatedAt: global.updatedAt.toISOString(),
      source: "GLOBAL",
      platformManaged: true,
    };
  }

  async assertStoreMutable(storeId: string, productId: string): Promise<void> {
    const local = await this.products.findByStoreAndId(storeId, productId);
    if (local) return;
    const association = await this.globals.findAssociation(storeId, productId);
    if (association) {
      const { GlobalResourceReadOnlyError } = await import("@/shared/errors/app-error");
      throw new GlobalResourceReadOnlyError(
        "Imported global products are platform-managed and cannot be edited here.",
      );
    }
    throw new NotFoundError("Product not found.");
  }

  async getCatalogByHandle(
    storeId: string,
    handle: string,
  ): Promise<ProductResponse & { source: "STORE" | "GLOBAL" }> {
    const local = await this.products.findActiveByStoreAndHandle(storeId, handle);
    if (local) {
      return { ...toProductResponse(local), source: "STORE" };
    }
    const global = await this.globals.findImportedActiveByHandle(storeId, handle);
    if (!global) throw new NotFoundError("Product not found.");
    return {
      id: global.id,
      storeId,
      categoryId: global.storeCategoryId,
      title: global.title,
      handle: global.handle,
      shortDescription: global.shortDescription,
      description: global.description,
      status: global.status,
      createdAt: global.createdAt.toISOString(),
      updatedAt: global.updatedAt.toISOString(),
      source: "GLOBAL",
    };
  }

  async listGlobalCatalogImages(productId: string) {
    return this.db.query.globalProductImages.findMany({
      where: eq(globalProductImages.productId, productId),
    });
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
    await this.assertStoreMutable(storeId, productId);
    if (input.handle) {
      const existing = await this.products.findByStoreAndHandle(storeId, input.handle);
      if (existing && existing.id !== productId) {
        throw new DuplicateResourceError("Product handle already exists.");
      }
    }
    const updated = await this.products.updateByStoreAndId(storeId, productId, input);
    if (!updated) throw new NotFoundError("Product not found.");
    return {
      ...toProductResponse(updated),
      source: "STORE",
      platformManaged: false,
    };
  }

  async remove(storeId: string, productId: string): Promise<void> {
    await this.assertStoreMutable(storeId, productId);
    const deleted = await this.products.deleteByStoreAndId(storeId, productId);
    if (!deleted) throw new NotFoundError("Product not found.");
  }
}

export type ProductServiceLike = ProductService;
