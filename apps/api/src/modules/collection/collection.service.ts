import { and, count, desc, eq, sql } from "drizzle-orm";
import { collectionProducts } from "@/db/schema/collection-products";
import { collections } from "@/db/schema/collections";
import { products } from "@/db/schema/products";
import type { Database } from "@/db/client";
import { DuplicateResourceError, NotFoundError } from "@/shared/errors";
import { normalizeSlug } from "@/shared/tenant/normalize";
import { paginationOffset } from "@/shared/pagination";

export type CollectionStatus = "ACTIVE" | "INACTIVE";

export type CollectionResponse = {
  id: string;
  storeId: string;
  name: string;
  slug: string;
  description: string | null;
  status: CollectionStatus;
  createdAt: string;
  updatedAt: string;
};

function toResponse(row: typeof collections.$inferSelect): CollectionResponse {
  return {
    id: row.id,
    storeId: row.storeId,
    name: row.name,
    slug: row.slug,
    description: row.description,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class CollectionService {
  constructor(private readonly db: Database) {}

  async list(storeId: string, query: { page: number; pageSize: number; status?: CollectionStatus }) {
    const whereClause = query.status
      ? and(eq(collections.storeId, storeId), eq(collections.status, query.status))
      : eq(collections.storeId, storeId);
    const [rows, totalRow] = await Promise.all([
      this.db
        .select()
        .from(collections)
        .where(whereClause)
        .orderBy(desc(collections.createdAt))
        .limit(query.pageSize)
        .offset(paginationOffset(query.page, query.pageSize)),
      this.db.select({ value: count() }).from(collections).where(whereClause),
    ]);
    return { items: rows.map(toResponse), total: Number(totalRow[0]?.value ?? 0) };
  }

  async getBySlug(storeId: string, slug: string) {
    const row = await this.db.query.collections.findFirst({
      where: and(eq(collections.storeId, storeId), eq(collections.slug, normalizeSlug(slug))),
    });
    if (!row || row.status !== "ACTIVE") throw new NotFoundError();
    return toResponse(row);
  }

  async create(
    storeId: string,
    input: { name: string; slug: string; description?: string | null; status?: CollectionStatus },
  ) {
    const slug = normalizeSlug(input.slug);
    const existing = await this.db.query.collections.findFirst({
      where: and(eq(collections.storeId, storeId), eq(collections.slug, slug)),
    });
    if (existing) throw new DuplicateResourceError();
    const [created] = await this.db
      .insert(collections)
      .values({
        storeId,
        name: input.name.trim(),
        slug,
        description: input.description ?? null,
        status: input.status ?? "ACTIVE",
      })
      .returning();
    if (!created) throw new Error("Failed to create collection.");
    return toResponse(created);
  }

  async update(
    storeId: string,
    collectionId: string,
    input: {
      name?: string;
      slug?: string;
      description?: string | null;
      status?: CollectionStatus;
    },
  ) {
    const existing = await this.db.query.collections.findFirst({
      where: and(eq(collections.id, collectionId), eq(collections.storeId, storeId)),
    });
    if (!existing) throw new NotFoundError();
    if (input.slug) {
      const slug = normalizeSlug(input.slug);
      const conflict = await this.db.query.collections.findFirst({
        where: and(eq(collections.storeId, storeId), eq(collections.slug, slug)),
      });
      if (conflict && conflict.id !== collectionId) throw new DuplicateResourceError();
    }
    const [updated] = await this.db
      .update(collections)
      .set({
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.slug !== undefined ? { slug: normalizeSlug(input.slug) } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        updatedAt: sql`now()`,
      })
      .where(and(eq(collections.id, collectionId), eq(collections.storeId, storeId)))
      .returning();
    if (!updated) throw new NotFoundError();
    return toResponse(updated);
  }

  async remove(storeId: string, collectionId: string) {
    await this.db
      .delete(collectionProducts)
      .where(
        and(eq(collectionProducts.storeId, storeId), eq(collectionProducts.collectionId, collectionId)),
      );
    const deleted = await this.db
      .delete(collections)
      .where(and(eq(collections.id, collectionId), eq(collections.storeId, storeId)))
      .returning({ id: collections.id });
    if (deleted.length === 0) throw new NotFoundError();
  }

  private async requireCollection(storeId: string, collectionId: string) {
    const row = await this.db.query.collections.findFirst({
      where: and(eq(collections.id, collectionId), eq(collections.storeId, storeId)),
    });
    if (!row) throw new NotFoundError("Collection not found.");
    return row;
  }

  async listProducts(storeId: string, collectionId: string) {
    await this.requireCollection(storeId, collectionId);
    const rows = await this.db.query.collectionProducts.findMany({
      where: and(
        eq(collectionProducts.storeId, storeId),
        eq(collectionProducts.collectionId, collectionId),
      ),
      with: { product: true },
    });
    return rows.map((row) => row.product).filter(Boolean);
  }

  async addProduct(storeId: string, collectionId: string, productId: string) {
    await this.requireCollection(storeId, collectionId);
    const product = await this.db.query.products.findFirst({
      where: and(eq(products.id, productId), eq(products.storeId, storeId)),
    });
    if (!product) throw new NotFoundError("Product not found.");
    const existing = await this.db.query.collectionProducts.findFirst({
      where: and(
        eq(collectionProducts.collectionId, collectionId),
        eq(collectionProducts.productId, productId),
      ),
    });
    if (existing) throw new DuplicateResourceError("Product already in collection.");
    await this.db.insert(collectionProducts).values({ storeId, collectionId, productId });
    return product;
  }

  async removeProduct(storeId: string, collectionId: string, productId: string) {
    await this.requireCollection(storeId, collectionId);
    const deleted = await this.db
      .delete(collectionProducts)
      .where(
        and(
          eq(collectionProducts.storeId, storeId),
          eq(collectionProducts.collectionId, collectionId),
          eq(collectionProducts.productId, productId),
        ),
      )
      .returning({ productId: collectionProducts.productId });
    if (deleted.length === 0) throw new NotFoundError("Product not in collection.");
  }

  async getBySlugWithProducts(storeId: string, slug: string) {
    const row = await this.db.query.collections.findFirst({
      where: and(
        eq(collections.storeId, storeId),
        eq(collections.slug, normalizeSlug(slug)),
        eq(collections.status, "ACTIVE"),
      ),
      with: {
        products: {
          with: {
            product: {
              with: { variants: true, images: true },
            },
          },
        },
      },
    });
    if (!row) throw new NotFoundError("Collection not found.");
    const linked = row.products
      .map((link) => link.product)
      .filter((product): product is NonNullable<typeof product> => Boolean(product))
      .filter((product) => product.status === "ACTIVE");
    return {
      ...toResponse(row),
      products: linked,
    };
  }
}
