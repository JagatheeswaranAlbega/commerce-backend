import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { productImages } from "@/db/schema/product-images";
import { products } from "@/db/schema/products";
import type { Database } from "@/db/client";
import { NotFoundError } from "@/shared/errors";

export type MediaResponse = {
  id: string;
  storeId: string;
  productId: string;
  storageKey: string;
  url: string | null;
  altText: string | null;
  sortOrder: number;
  isThumbnail: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Thumbnail first (if set), then remaining images in gallery order. */
const storefrontImageOrder = [
  desc(productImages.isThumbnail),
  asc(productImages.sortOrder),
  asc(productImages.createdAt),
] as const;

function toResponse(row: typeof productImages.$inferSelect): MediaResponse {
  return {
    id: row.id,
    storeId: row.storeId,
    productId: row.productId,
    storageKey: row.storageKey,
    url: row.url,
    altText: row.altText,
    sortOrder: row.sortOrder,
    isThumbnail: row.isThumbnail,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class MediaService {
  constructor(private readonly db: Database) {}

  async listByProduct(storeId: string, productId: string) {
    const product = await this.db.query.products.findFirst({
      where: and(eq(products.id, productId), eq(products.storeId, storeId)),
    });
    if (!product) throw new NotFoundError();

    const rows = await this.db
      .select()
      .from(productImages)
      .where(and(eq(productImages.storeId, storeId), eq(productImages.productId, productId)))
      .orderBy(...storefrontImageOrder);
    return rows.map(toResponse);
  }

  async create(
    storeId: string,
    productId: string,
    input: { storageKey: string; url?: string | null; altText?: string | null; sortOrder?: number },
  ) {
    const product = await this.db.query.products.findFirst({
      where: and(eq(products.id, productId), eq(products.storeId, storeId)),
    });
    if (!product) throw new NotFoundError();

    let sortOrder = input.sortOrder;
    if (sortOrder === undefined) {
      const [maxRow] = await this.db
        .select({ max: sql<number>`coalesce(max(${productImages.sortOrder}), -1)` })
        .from(productImages)
        .where(and(eq(productImages.storeId, storeId), eq(productImages.productId, productId)));
      sortOrder = Number(maxRow?.max ?? -1) + 1;
    }

    const [created] = await this.db
      .insert(productImages)
      .values({
        storeId,
        productId,
        storageKey: input.storageKey,
        url: input.url ?? null,
        altText: input.altText ?? null,
        sortOrder,
        isThumbnail: false,
      })
      .returning();
    if (!created) throw new Error("Failed to create media.");

    // First image on a product becomes the thumbnail automatically.
    const existingCount = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(productImages)
      .where(and(eq(productImages.storeId, storeId), eq(productImages.productId, productId)));
    if (Number(existingCount[0]?.total ?? 0) === 1) {
      return this.setThumbnail(storeId, created.id, true);
    }

    return toResponse(created);
  }

  async update(
    storeId: string,
    mediaId: string,
    input: { altText?: string | null; sortOrder?: number },
  ) {
    const existing = await this.db.query.productImages.findFirst({
      where: and(eq(productImages.id, mediaId), eq(productImages.storeId, storeId)),
    });
    if (!existing) throw new NotFoundError();

    const [updated] = await this.db
      .update(productImages)
      .set({
        ...(input.altText !== undefined ? { altText: input.altText } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(productImages.id, mediaId), eq(productImages.storeId, storeId)))
      .returning();
    if (!updated) throw new NotFoundError();
    return toResponse(updated);
  }

  /** Swap sortOrder between two images of the same product. */
  async swapSortOrder(storeId: string, mediaIdA: string, mediaIdB: string) {
    const a = await this.db.query.productImages.findFirst({
      where: and(eq(productImages.id, mediaIdA), eq(productImages.storeId, storeId)),
    });
    const b = await this.db.query.productImages.findFirst({
      where: and(eq(productImages.id, mediaIdB), eq(productImages.storeId, storeId)),
    });
    if (!a || !b) throw new NotFoundError();
    if (a.productId !== b.productId) {
      throw new NotFoundError();
    }

    return this.db.transaction(async (tx) => {
      await tx
        .update(productImages)
        .set({ sortOrder: b.sortOrder, updatedAt: new Date() })
        .where(and(eq(productImages.id, a.id), eq(productImages.storeId, storeId)));
      await tx
        .update(productImages)
        .set({ sortOrder: a.sortOrder, updatedAt: new Date() })
        .where(and(eq(productImages.id, b.id), eq(productImages.storeId, storeId)));
      return true;
    });
  }

  async remove(storeId: string, mediaId: string) {
    const [row] = await this.db
      .delete(productImages)
      .where(and(eq(productImages.id, mediaId), eq(productImages.storeId, storeId)))
      .returning();
    if (!row) throw new NotFoundError();
    return toResponse(row);
  }

  async getById(storeId: string, mediaId: string) {
    const row = await this.db.query.productImages.findFirst({
      where: and(eq(productImages.id, mediaId), eq(productImages.storeId, storeId)),
    });
    if (!row) throw new NotFoundError();
    return toResponse(row);
  }

  /**
   * Set (or clear) the explicit product thumbnail.
   * Only one image per product may be the thumbnail.
   * When cleared, storefront falls back to the first image in gallery order.
   */
  async setThumbnail(storeId: string, mediaId: string, isThumbnail: boolean) {
    const media = await this.db.query.productImages.findFirst({
      where: and(eq(productImages.id, mediaId), eq(productImages.storeId, storeId)),
    });
    if (!media) throw new NotFoundError();

    return this.db.transaction(async (tx) => {
      if (isThumbnail) {
        await tx
          .update(productImages)
          .set({ isThumbnail: false, updatedAt: new Date() })
          .where(
            and(
              eq(productImages.storeId, storeId),
              eq(productImages.productId, media.productId),
              eq(productImages.isThumbnail, true),
            ),
          );

        const [updated] = await tx
          .update(productImages)
          .set({ isThumbnail: true, updatedAt: new Date() })
          .where(and(eq(productImages.id, mediaId), eq(productImages.storeId, storeId)))
          .returning();
        if (!updated) throw new NotFoundError();
        return toResponse(updated);
      }

      const [updated] = await tx
        .update(productImages)
        .set({ isThumbnail: false, updatedAt: new Date() })
        .where(and(eq(productImages.id, mediaId), eq(productImages.storeId, storeId)))
        .returning();
      if (!updated) throw new NotFoundError();
      return toResponse(updated);
    });
  }

  /**
   * Main image per product for list cards:
   * explicit thumbnail if set, otherwise first image in gallery order.
   */
  async thumbnailsForProducts(storeId: string, productIds: string[]) {
    if (productIds.length === 0) return new Map<string, MediaResponse>();

    const rows = await this.db
      .select()
      .from(productImages)
      .where(
        and(eq(productImages.storeId, storeId), inArray(productImages.productId, productIds)),
      )
      .orderBy(...storefrontImageOrder);

    const map = new Map<string, MediaResponse>();
    for (const row of rows) {
      if (!map.has(row.productId)) map.set(row.productId, toResponse(row));
    }
    return map;
  }
}
