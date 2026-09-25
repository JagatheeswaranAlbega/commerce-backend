import { and, count, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { cartLineItems } from "@/db/schema/cart-line-items";
import { categories } from "@/db/schema/categories";
import { globalCategories } from "@/db/schema/global-categories";
import { globalProductImages } from "@/db/schema/global-product-images";
import { globalProductVariants } from "@/db/schema/global-product-variants";
import { globalProducts } from "@/db/schema/global-products";
import { inventory } from "@/db/schema/inventory";
import { products } from "@/db/schema/products";
import { storeGlobalProducts } from "@/db/schema/store-global-products";
import { wishlistItems } from "@/db/schema/wishlist-items";
import type {
  CreateGlobalCategoryInput,
  CreateGlobalProductInput,
  CreateGlobalVariantInput,
  GlobalCategoryRecord,
  GlobalImageRecord,
  GlobalProductRecord,
  GlobalVariantRecord,
  ImportedGlobalProductRecord,
  ListGlobalProductsQuery,
  StoreGlobalProductRecord,
  UpdateGlobalCategoryInput,
  UpdateGlobalProductInput,
  UpdateGlobalVariantInput,
} from "./global-catalog.types";

function toCategory(row: typeof globalCategories.$inferSelect): GlobalCategoryRecord {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    parentId: row.parentId,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toProduct(row: typeof globalProducts.$inferSelect): GlobalProductRecord {
  return {
    id: row.id,
    categoryId: row.categoryId,
    title: row.title,
    handle: row.handle,
    shortDescription: row.shortDescription,
    description: row.description,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toVariant(row: typeof globalProductVariants.$inferSelect): GlobalVariantRecord {
  return {
    id: row.id,
    productId: row.productId,
    sku: row.sku,
    title: row.title,
    pricePaise: row.pricePaise,
    compareAtPricePaise: row.compareAtPricePaise,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toImage(row: typeof globalProductImages.$inferSelect): GlobalImageRecord {
  return {
    id: row.id,
    productId: row.productId,
    storageKey: row.storageKey,
    url: row.url,
    altText: row.altText,
    sortOrder: row.sortOrder,
    isThumbnail: row.isThumbnail,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toAssociation(row: typeof storeGlobalProducts.$inferSelect): StoreGlobalProductRecord {
  return {
    id: row.id,
    storeId: row.storeId,
    globalProductId: row.globalProductId,
    storeCategoryId: row.storeCategoryId,
    status: row.status,
    importedAt: row.importedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toImportedProduct(
  row: typeof globalProducts.$inferSelect,
  storeCategoryId: string | null,
): ImportedGlobalProductRecord {
  return {
    ...toProduct(row),
    storeCategoryId,
  };
}

export class GlobalCatalogRepository {
  constructor(private readonly db: Database) {}

  // --- Categories ---

  async listCategories(status?: "ACTIVE" | "INACTIVE"): Promise<GlobalCategoryRecord[]> {
    const rows = await this.db.query.globalCategories.findMany({
      where: status ? eq(globalCategories.status, status) : undefined,
      orderBy: [desc(globalCategories.createdAt)],
    });
    return rows.map(toCategory);
  }

  async findCategoryById(id: string): Promise<GlobalCategoryRecord | null> {
    const row = await this.db.query.globalCategories.findFirst({
      where: eq(globalCategories.id, id),
    });
    return row ? toCategory(row) : null;
  }

  async findCategoryBySlug(slug: string): Promise<GlobalCategoryRecord | null> {
    const row = await this.db.query.globalCategories.findFirst({
      where: eq(globalCategories.slug, slug),
    });
    return row ? toCategory(row) : null;
  }

  async createCategory(input: CreateGlobalCategoryInput): Promise<GlobalCategoryRecord> {
    const [row] = await this.db
      .insert(globalCategories)
      .values({
        name: input.name,
        slug: input.slug,
        parentId: input.parentId ?? null,
        status: input.status ?? "ACTIVE",
      })
      .returning();
    return toCategory(row!);
  }

  async updateCategory(
    id: string,
    input: UpdateGlobalCategoryInput,
  ): Promise<GlobalCategoryRecord | null> {
    const [row] = await this.db
      .update(globalCategories)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        updatedAt: new Date(),
      })
      .where(eq(globalCategories.id, id))
      .returning();
    return row ? toCategory(row) : null;
  }

  async deleteCategory(id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(globalCategories)
      .where(eq(globalCategories.id, id))
      .returning({ id: globalCategories.id });
    return deleted.length > 0;
  }

  // --- Products ---

  async listChildCategoryIds(parentId: string): Promise<string[]> {
    const rows = await this.db.query.globalCategories.findMany({
      where: eq(globalCategories.parentId, parentId),
      columns: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async listProducts(query: {
    limit: number;
    offset: number;
    status?: GlobalProductRecord["status"];
    categoryId?: string;
    q?: string;
  }): Promise<{ items: GlobalProductRecord[]; total: number }> {
    const conditions = [];
    if (query.status) conditions.push(eq(globalProducts.status, query.status));
    if (query.categoryId) {
      const childIds = await this.listChildCategoryIds(query.categoryId);
      conditions.push(inArray(globalProducts.categoryId, [query.categoryId, ...childIds]));
    }
    if (query.q) conditions.push(ilike(globalProducts.title, `%${query.q}%`));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, totalRow] = await Promise.all([
      this.db.query.globalProducts.findMany({
        where,
        orderBy: [desc(globalProducts.createdAt)],
        limit: query.limit,
        offset: query.offset,
      }),
      this.db.select({ total: count() }).from(globalProducts).where(where),
    ]);
    return { items: items.map(toProduct), total: Number(totalRow[0]?.total ?? 0) };
  }

  async findProductById(id: string): Promise<GlobalProductRecord | null> {
    const row = await this.db.query.globalProducts.findFirst({
      where: eq(globalProducts.id, id),
    });
    return row ? toProduct(row) : null;
  }

  async findProductByHandle(handle: string): Promise<GlobalProductRecord | null> {
    const row = await this.db.query.globalProducts.findFirst({
      where: eq(globalProducts.handle, handle),
    });
    return row ? toProduct(row) : null;
  }

  async createProduct(input: CreateGlobalProductInput): Promise<GlobalProductRecord> {
    const [row] = await this.db
      .insert(globalProducts)
      .values({
        title: input.title,
        handle: input.handle,
        shortDescription: input.shortDescription ?? null,
        description: input.description ?? null,
        status: input.status ?? "DRAFT",
        categoryId: input.categoryId ?? null,
      })
      .returning();
    return toProduct(row!);
  }

  async updateProduct(
    id: string,
    input: UpdateGlobalProductInput,
  ): Promise<GlobalProductRecord | null> {
    const [row] = await this.db
      .update(globalProducts)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.handle !== undefined ? { handle: input.handle } : {}),
        ...(input.shortDescription !== undefined
          ? { shortDescription: input.shortDescription }
          : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        updatedAt: new Date(),
      })
      .where(eq(globalProducts.id, id))
      .returning();
    return row ? toProduct(row) : null;
  }

  async deleteProduct(id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(globalProducts)
      .where(eq(globalProducts.id, id))
      .returning({ id: globalProducts.id });
    return deleted.length > 0;
  }

  async countImportsByProductIds(productIds: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (productIds.length === 0) return map;
    const rows = await this.db
      .select({
        globalProductId: storeGlobalProducts.globalProductId,
        total: count(),
      })
      .from(storeGlobalProducts)
      .where(inArray(storeGlobalProducts.globalProductId, productIds))
      .groupBy(storeGlobalProducts.globalProductId);
    for (const row of rows) {
      map.set(row.globalProductId, Number(row.total));
    }
    return map;
  }

  // --- Variants ---

  async listVariantsByProduct(productId: string): Promise<GlobalVariantRecord[]> {
    const rows = await this.db.query.globalProductVariants.findMany({
      where: eq(globalProductVariants.productId, productId),
      orderBy: [desc(globalProductVariants.createdAt)],
    });
    return rows.map(toVariant);
  }

  async findVariantById(id: string): Promise<GlobalVariantRecord | null> {
    const row = await this.db.query.globalProductVariants.findFirst({
      where: eq(globalProductVariants.id, id),
    });
    return row ? toVariant(row) : null;
  }

  async findVariantBySku(sku: string): Promise<GlobalVariantRecord | null> {
    const row = await this.db.query.globalProductVariants.findFirst({
      where: eq(globalProductVariants.sku, sku),
    });
    return row ? toVariant(row) : null;
  }

  async createVariant(
    productId: string,
    input: CreateGlobalVariantInput,
  ): Promise<GlobalVariantRecord> {
    const [row] = await this.db
      .insert(globalProductVariants)
      .values({
        productId,
        sku: input.sku,
        title: input.title,
        pricePaise: input.pricePaise,
        compareAtPricePaise: input.compareAtPricePaise ?? null,
        status: input.status ?? "DRAFT",
      })
      .returning();
    return toVariant(row!);
  }

  async updateVariant(
    productId: string,
    variantId: string,
    input: UpdateGlobalVariantInput,
  ): Promise<GlobalVariantRecord | null> {
    const [row] = await this.db
      .update(globalProductVariants)
      .set({
        ...(input.sku !== undefined ? { sku: input.sku } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.pricePaise !== undefined ? { pricePaise: input.pricePaise } : {}),
        ...(input.compareAtPricePaise !== undefined
          ? { compareAtPricePaise: input.compareAtPricePaise }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(globalProductVariants.id, variantId),
          eq(globalProductVariants.productId, productId),
        ),
      )
      .returning();
    return row ? toVariant(row) : null;
  }

  async deleteVariant(productId: string, variantId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(globalProductVariants)
      .where(
        and(
          eq(globalProductVariants.id, variantId),
          eq(globalProductVariants.productId, productId),
        ),
      )
      .returning({ id: globalProductVariants.id });
    return deleted.length > 0;
  }

  // --- Images ---

  async listImagesByProduct(productId: string): Promise<GlobalImageRecord[]> {
    const rows = await this.db.query.globalProductImages.findMany({
      where: eq(globalProductImages.productId, productId),
      orderBy: [globalProductImages.sortOrder],
    });
    return rows.map(toImage);
  }

  async listImagesByProductIds(productIds: string[]): Promise<GlobalImageRecord[]> {
    if (productIds.length === 0) return [];
    const rows = await this.db.query.globalProductImages.findMany({
      where: inArray(globalProductImages.productId, productIds),
      orderBy: [globalProductImages.sortOrder],
    });
    return rows.map(toImage);
  }

  async findImageById(id: string): Promise<GlobalImageRecord | null> {
    const row = await this.db.query.globalProductImages.findFirst({
      where: eq(globalProductImages.id, id),
    });
    return row ? toImage(row) : null;
  }

  async createImage(input: {
    productId: string;
    storageKey: string;
    url?: string | null;
    altText?: string | null;
    sortOrder?: number;
    isThumbnail?: boolean;
  }): Promise<GlobalImageRecord> {
    if (input.isThumbnail) {
      await this.db
        .update(globalProductImages)
        .set({ isThumbnail: false, updatedAt: new Date() })
        .where(eq(globalProductImages.productId, input.productId));
    }
    const [row] = await this.db
      .insert(globalProductImages)
      .values({
        productId: input.productId,
        storageKey: input.storageKey,
        url: input.url ?? null,
        altText: input.altText ?? null,
        sortOrder: input.sortOrder ?? 0,
        isThumbnail: input.isThumbnail ?? false,
      })
      .returning();
    return toImage(row!);
  }

  async setImageThumbnail(
    productId: string,
    imageId: string,
    isThumbnail = true,
  ): Promise<GlobalImageRecord | null> {
    if (!isThumbnail) {
      const [row] = await this.db
        .update(globalProductImages)
        .set({ isThumbnail: false, updatedAt: new Date() })
        .where(
          and(eq(globalProductImages.id, imageId), eq(globalProductImages.productId, productId)),
        )
        .returning();
      return row ? toImage(row) : null;
    }

    await this.db
      .update(globalProductImages)
      .set({ isThumbnail: false, updatedAt: new Date() })
      .where(eq(globalProductImages.productId, productId));
    const [row] = await this.db
      .update(globalProductImages)
      .set({ isThumbnail: true, updatedAt: new Date() })
      .where(and(eq(globalProductImages.id, imageId), eq(globalProductImages.productId, productId)))
      .returning();
    return row ? toImage(row) : null;
  }

  async deleteImage(imageId: string): Promise<GlobalImageRecord | null> {
    const [row] = await this.db
      .delete(globalProductImages)
      .where(eq(globalProductImages.id, imageId))
      .returning();
    return row ? toImage(row) : null;
  }

  // --- Store associations ---

  async findAssociation(
    storeId: string,
    globalProductId: string,
  ): Promise<StoreGlobalProductRecord | null> {
    const row = await this.db.query.storeGlobalProducts.findFirst({
      where: and(
        eq(storeGlobalProducts.storeId, storeId),
        eq(storeGlobalProducts.globalProductId, globalProductId),
      ),
    });
    return row ? toAssociation(row) : null;
  }

  async listImportedProductIds(
    storeId: string,
    opts?: { storeCategoryId?: string },
  ): Promise<Set<string>> {
    const conditions = [eq(storeGlobalProducts.storeId, storeId)];
    if (opts?.storeCategoryId) {
      conditions.push(eq(storeGlobalProducts.storeCategoryId, opts.storeCategoryId));
    }
    const rows = await this.db
      .select({ id: storeGlobalProducts.globalProductId })
      .from(storeGlobalProducts)
      .where(and(...conditions));
    return new Set(rows.map((r) => r.id));
  }

  async listImportedCategoryMap(storeId: string): Promise<Map<string, string | null>> {
    const rows = await this.db
      .select({
        globalProductId: storeGlobalProducts.globalProductId,
        storeCategoryId: storeGlobalProducts.storeCategoryId,
      })
      .from(storeGlobalProducts)
      .where(eq(storeGlobalProducts.storeId, storeId));
    return new Map(rows.map((row) => [row.globalProductId, row.storeCategoryId]));
  }

  async findStoreCategory(
    storeId: string,
    categoryId: string,
  ): Promise<{ id: string; storeId: string; slug: string } | null> {
    const row = await this.db.query.categories.findFirst({
      where: and(eq(categories.id, categoryId), eq(categories.storeId, storeId)),
      columns: { id: true, storeId: true, slug: true },
    });
    return row ?? null;
  }

  async findStoreCategoryBySlug(
    storeId: string,
    slug: string,
  ): Promise<{ id: string } | null> {
    const row = await this.db.query.categories.findFirst({
      where: and(eq(categories.storeId, storeId), eq(categories.slug, slug)),
      columns: { id: true },
    });
    return row ?? null;
  }

  async createStoreCategory(
    storeId: string,
    input: { name: string; slug: string },
  ): Promise<{ id: string }> {
    const [row] = await this.db
      .insert(categories)
      .values({
        storeId,
        name: input.name,
        slug: input.slug,
        status: "ACTIVE",
      })
      .returning({ id: categories.id });
    return row!;
  }

  async updateAssociationCategory(
    storeId: string,
    globalProductId: string,
    storeCategoryId: string,
  ): Promise<StoreGlobalProductRecord | null> {
    const [row] = await this.db
      .update(storeGlobalProducts)
      .set({
        storeCategoryId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(storeGlobalProducts.storeId, storeId),
          eq(storeGlobalProducts.globalProductId, globalProductId),
        ),
      )
      .returning();
    return row ? toAssociation(row) : null;
  }

  async findLocalProductByHandle(
    storeId: string,
    handle: string,
  ): Promise<{ id: string } | null> {
    const row = await this.db.query.products.findFirst({
      where: and(eq(products.storeId, storeId), eq(products.handle, handle)),
      columns: { id: true },
    });
    return row ?? null;
  }

  async importProduct(
    storeId: string,
    globalProductId: string,
    variantIds: string[],
    storeCategoryId: string,
  ): Promise<StoreGlobalProductRecord> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(storeGlobalProducts)
        .values({
          storeId,
          globalProductId,
          storeCategoryId,
          status: "ACTIVE",
        })
        .returning();

      if (variantIds.length > 0) {
        await tx.insert(inventory).values(
          variantIds.map((variantId) => ({
            storeId,
            variantId,
            source: "GLOBAL" as const,
            availableQuantity: 0,
            reservedQuantity: 0,
          })),
        );
      }

      return toAssociation(row!);
    });
  }

  async removeImport(storeId: string, globalProductId: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const variants = await tx
        .select({ id: globalProductVariants.id })
        .from(globalProductVariants)
        .where(eq(globalProductVariants.productId, globalProductId));
      const variantIds = variants.map((v) => v.id);

      if (variantIds.length > 0) {
        await tx
          .delete(cartLineItems)
          .where(
            and(
              eq(cartLineItems.storeId, storeId),
              eq(cartLineItems.source, "GLOBAL"),
              inArray(cartLineItems.variantId, variantIds),
            ),
          );
        await tx
          .delete(wishlistItems)
          .where(
            and(
              eq(wishlistItems.storeId, storeId),
              eq(wishlistItems.source, "GLOBAL"),
              inArray(wishlistItems.variantId, variantIds),
            ),
          );
        await tx
          .delete(inventory)
          .where(
            and(
              eq(inventory.storeId, storeId),
              eq(inventory.source, "GLOBAL"),
              inArray(inventory.variantId, variantIds),
            ),
          );
      }

      const deleted = await tx
        .delete(storeGlobalProducts)
        .where(
          and(
            eq(storeGlobalProducts.storeId, storeId),
            eq(storeGlobalProducts.globalProductId, globalProductId),
          ),
        )
        .returning({ id: storeGlobalProducts.id });
      return deleted.length > 0;
    });
  }

  async listImportedActiveProducts(
    storeId: string,
    opts: {
      limit: number;
      offset: number;
      categoryId?: string;
      q?: string;
    },
  ): Promise<{ items: ImportedGlobalProductRecord[]; total: number }> {
    const conditions = [
      eq(storeGlobalProducts.storeId, storeId),
      eq(storeGlobalProducts.status, "ACTIVE"),
      eq(globalProducts.status, "ACTIVE"),
    ];
    if (opts.categoryId) {
      conditions.push(eq(storeGlobalProducts.storeCategoryId, opts.categoryId));
    }
    if (opts.q) conditions.push(ilike(globalProducts.title, `%${opts.q}%`));

    const where = and(...conditions);
    const [rows, totalRow] = await Promise.all([
      this.db
        .select({
          product: globalProducts,
          storeCategoryId: storeGlobalProducts.storeCategoryId,
        })
        .from(storeGlobalProducts)
        .innerJoin(globalProducts, eq(storeGlobalProducts.globalProductId, globalProducts.id))
        .where(where)
        .orderBy(desc(globalProducts.createdAt))
        .limit(opts.limit)
        .offset(opts.offset),
      this.db
        .select({ total: count() })
        .from(storeGlobalProducts)
        .innerJoin(globalProducts, eq(storeGlobalProducts.globalProductId, globalProducts.id))
        .where(where),
    ]);
    return {
      items: rows.map((r) => toImportedProduct(r.product, r.storeCategoryId)),
      total: Number(totalRow[0]?.total ?? 0),
    };
  }

  async findImportedActiveByHandle(
    storeId: string,
    handle: string,
  ): Promise<ImportedGlobalProductRecord | null> {
    const [row] = await this.db
      .select({
        product: globalProducts,
        storeCategoryId: storeGlobalProducts.storeCategoryId,
      })
      .from(storeGlobalProducts)
      .innerJoin(globalProducts, eq(storeGlobalProducts.globalProductId, globalProducts.id))
      .where(
        and(
          eq(storeGlobalProducts.storeId, storeId),
          eq(storeGlobalProducts.status, "ACTIVE"),
          eq(globalProducts.status, "ACTIVE"),
          eq(globalProducts.handle, handle),
        ),
      )
      .limit(1);
    return row ? toImportedProduct(row.product, row.storeCategoryId) : null;
  }

  async listActiveImportedCategoryIds(storeId: string): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ categoryId: storeGlobalProducts.storeCategoryId })
      .from(storeGlobalProducts)
      .innerJoin(globalProducts, eq(storeGlobalProducts.globalProductId, globalProducts.id))
      .where(
        and(
          eq(storeGlobalProducts.storeId, storeId),
          eq(storeGlobalProducts.status, "ACTIVE"),
          eq(globalProducts.status, "ACTIVE"),
          sql`${storeGlobalProducts.storeCategoryId} is not null`,
        ),
      );
    return rows.map((r) => r.categoryId!).filter(Boolean);
  }

  async filterProductsByImport(
    storeId: string,
    query: ListGlobalProductsQuery,
  ): Promise<{ items: GlobalProductRecord[]; total: number; importedIds: Set<string> }> {
    const importedIds = await this.listImportedProductIds(storeId);
    const offset = (query.page - 1) * query.pageSize;
    const result = await this.listProducts({
      limit: query.pageSize * 5,
      offset: 0,
      status: query.status,
      categoryId: query.categoryId,
      q: query.q,
    });

    let items = result.items;
    if (query.imported === true) {
      items = items.filter((p) => importedIds.has(p.id));
    } else if (query.imported === false) {
      items = items.filter((p) => !importedIds.has(p.id));
    }

    const total = items.length;
    const pageItems = items.slice(offset, offset + query.pageSize);
    return { items: pageItems, total, importedIds };
  }
}
