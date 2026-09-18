import { and, count, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { collectionProducts } from "@/db/schema/collection-products";
import { inventory } from "@/db/schema/inventory";
import { productVariants } from "@/db/schema/product-variants";
import { products } from "@/db/schema/products";
import type { Database } from "@/db/client";
import type {
  CatalogProductPricing,
  CreateProductInput,
  ListProductsResult,
  ProductRecord,
  ProductStatus,
  UpdateProductInput,
} from "@/modules/product/product.types";

export type ProductRepositoryLike = {
  findByStoreAndId(storeId: string, id: string): Promise<ProductRecord | null>;
  findByStoreAndHandle(storeId: string, handle: string): Promise<ProductRecord | null>;
  findActiveByStoreAndHandle(storeId: string, handle: string): Promise<ProductRecord | null>;
  listByStore(
    storeId: string,
    options: {
      limit: number;
      offset: number;
      status?: ProductStatus;
      categoryId?: string;
      q?: string;
    },
  ): Promise<ListProductsResult>;
  listPublished(
    storeId: string,
    options: {
      limit: number;
      offset: number;
      categoryId?: string;
      collectionId?: string;
      q?: string;
      sort?: "created_at_desc" | "price_asc" | "price_desc";
      inStock?: boolean;
      minPricePaise?: number;
      maxPricePaise?: number;
    },
  ): Promise<ListProductsResult & { pricing: Map<string, CatalogProductPricing> }>;
  listAll(options: {
    limit: number;
    offset: number;
    storeId?: string;
    status?: ProductStatus;
  }): Promise<ListProductsResult>;
  create(storeId: string, input: CreateProductInput): Promise<ProductRecord>;
  updateByStoreAndId(
    storeId: string,
    id: string,
    input: UpdateProductInput,
  ): Promise<ProductRecord | null>;
  deleteByStoreAndId(storeId: string, id: string): Promise<boolean>;
  countByCategoryId(storeId: string, categoryId: string): Promise<number>;
};

function toRecord(row: typeof products.$inferSelect): ProductRecord {
  return {
    id: row.id,
    storeId: row.storeId,
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

export class ProductRepository implements ProductRepositoryLike {
  constructor(private readonly db: Database) {}

  async findByStoreAndId(storeId: string, id: string): Promise<ProductRecord | null> {
    const row = await this.db.query.products.findFirst({
      where: and(eq(products.id, id), eq(products.storeId, storeId)),
    });
    return row ? toRecord(row) : null;
  }

  async findByStoreAndHandle(storeId: string, handle: string): Promise<ProductRecord | null> {
    const row = await this.db.query.products.findFirst({
      where: and(eq(products.storeId, storeId), eq(products.handle, handle)),
    });
    return row ? toRecord(row) : null;
  }

  async findActiveByStoreAndHandle(storeId: string, handle: string): Promise<ProductRecord | null> {
    const row = await this.db.query.products.findFirst({
      where: and(
        eq(products.storeId, storeId),
        eq(products.handle, handle),
        eq(products.status, "ACTIVE"),
      ),
    });
    return row ? toRecord(row) : null;
  }

  async listByStore(
    storeId: string,
    options: {
      limit: number;
      offset: number;
      status?: ProductStatus;
      categoryId?: string;
      q?: string;
    },
  ): Promise<ListProductsResult> {
    const clauses = [eq(products.storeId, storeId)];
    if (options.status) clauses.push(eq(products.status, options.status));
    if (options.categoryId) clauses.push(eq(products.categoryId, options.categoryId));
    if (options.q) {
      const pattern = `%${options.q}%`;
      clauses.push(
        sql`(${ilike(products.title, pattern)} or ${ilike(products.handle, pattern)} or ${ilike(products.shortDescription, pattern)} or ${ilike(products.description, pattern)})`,
      );
    }
    const whereClause = and(...clauses);

    const [rows, totalRow] = await Promise.all([
      this.db
        .select()
        .from(products)
        .where(whereClause)
        .orderBy(desc(products.createdAt))
        .limit(options.limit)
        .offset(options.offset),
      this.db.select({ value: count() }).from(products).where(whereClause),
    ]);

    return { items: rows.map(toRecord), total: Number(totalRow[0]?.value ?? 0) };
  }

  async listPublished(
    storeId: string,
    options: {
      limit: number;
      offset: number;
      categoryId?: string;
      collectionId?: string;
      q?: string;
      sort?: "created_at_desc" | "price_asc" | "price_desc";
      inStock?: boolean;
      minPricePaise?: number;
      maxPricePaise?: number;
    },
  ): Promise<ListProductsResult & { pricing: Map<string, CatalogProductPricing> }> {
    const clauses = [eq(products.storeId, storeId), eq(products.status, "ACTIVE")];
    if (options.categoryId) clauses.push(eq(products.categoryId, options.categoryId));
    if (options.q) {
      const pattern = `%${options.q}%`;
      clauses.push(
        sql`(${ilike(products.title, pattern)} or ${ilike(products.handle, pattern)} or ${ilike(products.shortDescription, pattern)} or ${ilike(products.description, pattern)})`,
      );
    }
    if (options.collectionId) {
      const membership = await this.db
        .select({ productId: collectionProducts.productId })
        .from(collectionProducts)
        .where(
          and(
            eq(collectionProducts.storeId, storeId),
            eq(collectionProducts.collectionId, options.collectionId),
          ),
        );
      const ids = membership.map((row) => row.productId);
      if (ids.length === 0) return { items: [], total: 0, pricing: new Map() };
      clauses.push(inArray(products.id, ids));
    }

    const whereClause = and(...clauses);
    const candidateRows = await this.db.select().from(products).where(whereClause);
    if (candidateRows.length === 0) {
      return { items: [], total: 0, pricing: new Map() };
    }

    const candidateIds = candidateRows.map((row) => row.id);
    const variantRows = await this.db
      .select({
        productId: productVariants.productId,
        pricePaise: productVariants.pricePaise,
        compareAtPricePaise: productVariants.compareAtPricePaise,
        variantId: productVariants.id,
      })
      .from(productVariants)
      .where(
        and(
          eq(productVariants.storeId, storeId),
          eq(productVariants.status, "ACTIVE"),
          inArray(productVariants.productId, candidateIds),
        ),
      );

    const variantIds = variantRows.map((row) => row.variantId);
    const stockRows =
      variantIds.length === 0
        ? []
        : await this.db
            .select({
              variantId: inventory.variantId,
              availableQuantity: inventory.availableQuantity,
            })
            .from(inventory)
            .where(
              and(eq(inventory.storeId, storeId), inArray(inventory.variantId, variantIds)),
            );
    const stockByVariant = new Map(
      stockRows.map((row) => [row.variantId, row.availableQuantity]),
    );

    const pricing = new Map<string, CatalogProductPricing>();
    for (const productId of candidateIds) {
      const variants = variantRows.filter((row) => row.productId === productId);
      if (variants.length === 0) {
        pricing.set(productId, {
          minPricePaise: null,
          maxPricePaise: null,
          compareAtPricePaise: null,
          inStock: false,
        });
        continue;
      }
      const prices = variants.map((v) => v.pricePaise);
      const minPricePaise = Math.min(...prices);
      const maxPricePaise = Math.max(...prices);
      const cheapest = variants.reduce((best, row) =>
        row.pricePaise < best.pricePaise ? row : best,
      );
      const inStock = variants.some((row) => (stockByVariant.get(row.variantId) ?? 0) > 0);
      pricing.set(productId, {
        minPricePaise,
        maxPricePaise,
        compareAtPricePaise: cheapest.compareAtPricePaise,
        inStock,
      });
    }

    let filtered = candidateRows.filter((row) => {
      const meta = pricing.get(row.id);
      if (!meta || meta.minPricePaise === null) return false;
      if (options.inStock === true && !meta.inStock) return false;
      if (options.inStock === false && meta.inStock) return false;
      if (
        options.minPricePaise !== undefined &&
        (meta.minPricePaise === null || meta.minPricePaise < options.minPricePaise)
      ) {
        return false;
      }
      if (
        options.maxPricePaise !== undefined &&
        (meta.minPricePaise === null || meta.minPricePaise > options.maxPricePaise)
      ) {
        return false;
      }
      return true;
    });

    const sort = options.sort ?? "created_at_desc";
    filtered = [...filtered].sort((a, b) => {
      if (sort === "price_asc" || sort === "price_desc") {
        const aPrice = pricing.get(a.id)?.minPricePaise ?? Number.POSITIVE_INFINITY;
        const bPrice = pricing.get(b.id)?.minPricePaise ?? Number.POSITIVE_INFINITY;
        return sort === "price_asc" ? aPrice - bPrice : bPrice - aPrice;
      }
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    const total = filtered.length;
    const pageRows = filtered.slice(options.offset, options.offset + options.limit);
    const pagePricing = new Map<string, CatalogProductPricing>();
    for (const row of pageRows) {
      const meta = pricing.get(row.id);
      if (meta) pagePricing.set(row.id, meta);
    }

    return {
      items: pageRows.map(toRecord),
      total,
      pricing: pagePricing,
    };
  }

  async listAll(options: {
    limit: number;
    offset: number;
    storeId?: string;
    status?: ProductStatus;
  }): Promise<ListProductsResult> {
    const clauses = [];
    if (options.storeId) clauses.push(eq(products.storeId, options.storeId));
    if (options.status) clauses.push(eq(products.status, options.status));
    const whereClause = clauses.length ? and(...clauses) : undefined;

    const [rows, totalRow] = await Promise.all([
      this.db
        .select()
        .from(products)
        .where(whereClause)
        .orderBy(desc(products.createdAt))
        .limit(options.limit)
        .offset(options.offset),
      this.db.select({ value: count() }).from(products).where(whereClause),
    ]);

    return { items: rows.map(toRecord), total: Number(totalRow[0]?.value ?? 0) };
  }

  async create(storeId: string, input: CreateProductInput): Promise<ProductRecord> {
    const [row] = await this.db
      .insert(products)
      .values({
        storeId,
        title: input.title,
        handle: input.handle,
        shortDescription: input.shortDescription ?? null,
        description: input.description ?? null,
        status: input.status ?? "DRAFT",
        categoryId: input.categoryId ?? null,
      })
      .returning();
    if (!row) throw new Error("Failed to create product.");
    return toRecord(row);
  }

  async updateByStoreAndId(
    storeId: string,
    id: string,
    input: UpdateProductInput,
  ): Promise<ProductRecord | null> {
    const [row] = await this.db
      .update(products)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.handle !== undefined ? { handle: input.handle } : {}),
        ...(input.shortDescription !== undefined
          ? { shortDescription: input.shortDescription }
          : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        updatedAt: sql`now()`,
      })
      .where(and(eq(products.id, id), eq(products.storeId, storeId)))
      .returning();
    return row ? toRecord(row) : null;
  }

  async deleteByStoreAndId(storeId: string, id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(products)
      .where(and(eq(products.id, id), eq(products.storeId, storeId)))
      .returning({ id: products.id });
    return deleted.length > 0;
  }

  async countByCategoryId(storeId: string, categoryId: string): Promise<number> {
    const [totalRow] = await this.db
      .select({ value: count() })
      .from(products)
      .where(and(eq(products.storeId, storeId), eq(products.categoryId, categoryId)));
    return Number(totalRow?.value ?? 0);
  }
}
