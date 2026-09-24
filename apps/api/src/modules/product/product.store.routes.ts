import type { Context } from "hono";
import type { Hono } from "hono";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { scheduleDbClose, useRequestDb } from "@/middleware/database";
import { ProductService } from "@/modules/product/product.service";
import {
  createProductBodySchema,
  listProductsQuerySchema,
  updateProductBodySchema,
} from "@/modules/product/product.schemas";
import { VariantRepository } from "@/modules/variant/variant.repository";
import { toVariantResponse } from "@/modules/variant/variant.types";
import { AUDIT_ACTIONS, actorFromAuth, writeAuditLog } from "@/modules/audit";
import { StoreService } from "@/modules/store/store.service";
import { categories } from "@/db/schema/categories";
import { inventory } from "@/db/schema/inventory";
import { inventoryMovements } from "@/db/schema/inventory-movements";
import { DuplicateResourceError, NotFoundError, ValidationError } from "@/shared/errors/app-error";
import { HTTP_STATUS } from "@/shared/constants/http";
import { SUCCESS_MESSAGES } from "@/shared/constants/success-messages";
import { sendSuccess } from "@/shared/response/success";
import type { AppEnv } from "@/shared/types/hono";

export type ResolveStoreId = (c: Context<AppEnv>) => string | Promise<string>;

const variantBody = z.object({
  sku: z.string().min(1),
  title: z.string().min(1),
  pricePaise: z.number().int().nonnegative(),
  compareAtPricePaise: z.number().int().nonnegative().nullable().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
  /** Initial on-hand qty when creating a variant (ignored on PATCH). */
  initialQuantity: z.number().int().nonnegative().optional(),
});

const storeIdParamSchema = z.string().uuid();

function routeParam(c: Context<AppEnv>, name: string): string {
  const value = c.req.param(name);
  if (!value) throw new ValidationError(`Missing ${name}.`);
  return value;
}

export function resolveStoreIdFromAuth(c: Context<AppEnv>): string {
  const storeId = c.get("auth")?.storeId;
  if (!storeId) throw new ValidationError("Store scope missing.");
  return storeId;
}

/** Path `:storeId` after platform auth — never from JWT, never a null-as-global shortcut. */
export async function resolveStoreIdFromPath(c: Context<AppEnv>): Promise<string> {
  const parsed = storeIdParamSchema.safeParse(c.req.param("storeId"));
  if (!parsed.success) {
    throw new ValidationError("Invalid store id.", parsed.error.flatten());
  }
  const { db, opened } = await useRequestDb(c);
  if (opened) scheduleDbClose(c, opened);
  await new StoreService(db).get(parsed.data);
  return parsed.data;
}

export function registerStoreProductRoutes(
  app: Hono<AppEnv>,
  resolveStoreId: ResolveStoreId,
  options?: { includeCategoryList?: boolean; pathPrefix?: string },
) {
  const prefix = options?.pathPrefix ?? "";
  const path = (suffix: string) => `${prefix}${suffix}`;

  app.get(path("/products"), async (c) => {
    const parsed = listProductsQuerySchema.safeParse(c.req.query());
    if (!parsed.success) throw new ValidationError("Invalid query.", parsed.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const storeId = await resolveStoreId(c);
    const result = await new ProductService(db).listForStore(storeId, parsed.data);
    const { MediaService } = await import("@/modules/media/media.service");
    const localIds = result.items.filter((i) => i.source !== "GLOBAL").map((i) => i.id);
    const globalIds = result.items.filter((i) => i.source === "GLOBAL").map((i) => i.id);
    const thumbnails = await new MediaService(db).thumbnailsForProducts(storeId, localIds);

    const globalThumbs = new Map<
      string,
      { id: string; altText: string | null; url: string | null }
    >();
    if (globalIds.length > 0) {
      const { globalProductImages } = await import("@/db/schema/global-product-images");
      const { inArray } = await import("drizzle-orm");
      const rows = await db
        .select()
        .from(globalProductImages)
        .where(inArray(globalProductImages.productId, globalIds));
      for (const productId of globalIds) {
        const images = rows.filter((r) => r.productId === productId);
        const thumb =
          images.find((i) => i.isThumbnail) ??
          [...images].sort((a, b) => a.sortOrder - b.sortOrder)[0];
        if (thumb) {
          globalThumbs.set(productId, {
            id: thumb.id,
            altText: thumb.altText,
            url: thumb.url,
          });
        }
      }
    }

    const items = result.items.map((item) => {
      const thumb =
        item.source === "GLOBAL" ? globalThumbs.get(item.id) : thumbnails.get(item.id);
      return {
        ...item,
        thumbnail: thumb
          ? { id: thumb.id, altText: thumb.altText, url: thumb.url }
          : null,
      };
    });
    return sendSuccess(c, items, {
      message: SUCCESS_MESSAGES.PRODUCTS_RETRIEVED,
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / result.pageSize) || 1,
      },
    });
  });

  app.post(path("/products"), async (c) => {
    const parsed = createProductBodySchema.safeParse(await c.req.json());
    if (!parsed.success) throw new ValidationError("Invalid product.", parsed.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const storeId = await resolveStoreId(c);
    const product = await new ProductService(db).create(storeId, parsed.data);
    const actor = actorFromAuth(c.get("auth"));
    await writeAuditLog(db, {
      storeId,
      actorUserId: actor.actorUserId,
      action: AUDIT_ACTIONS.PRODUCT_CREATE,
      resourceType: "product",
      resourceId: product.id,
    });
    return sendSuccess(c, product, {
      message: SUCCESS_MESSAGES.PRODUCT_CREATED,
      status: HTTP_STATUS.CREATED,
    });
  });

  app.get(path("/products/:productId"), async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const storeId = await resolveStoreId(c);
    const product = await new ProductService(db).getForStore(storeId, routeParam(c, "productId"));

    if (product.source === "GLOBAL") {
      const { GlobalCatalogService } = await import("@/modules/global-catalog");
      const detail = await new GlobalCatalogService(db).getProduct(product.id, storeId);
      return sendSuccess(
        c,
        {
          ...product,
          variants: detail.variants.map((v) => ({
            id: v.id,
            storeId,
            productId: v.productId,
            sku: v.sku,
            title: v.title,
            pricePaise: v.pricePaise,
            compareAtPricePaise: v.compareAtPricePaise,
            status: v.status,
            createdAt: v.createdAt,
            updatedAt: v.updatedAt,
            source: "GLOBAL" as const,
          })),
          images: detail.images.map((image) => ({
            ...image,
            storeId,
            source: "GLOBAL" as const,
          })),
        },
        { message: SUCCESS_MESSAGES.PRODUCT_RETRIEVED },
      );
    }

    const variants = await new VariantRepository(db).listByProduct(storeId, product.id);
    const { MediaService } = await import("@/modules/media/media.service");
    const images = await new MediaService(db).listByProduct(storeId, product.id);
    return sendSuccess(
      c,
      {
        ...product,
        variants: variants.map((v) => toVariantResponse(v)),
        images,
      },
      { message: SUCCESS_MESSAGES.PRODUCT_RETRIEVED },
    );
  });

  app.patch(path("/products/:productId"), async (c) => {
    const parsed = updateProductBodySchema.safeParse(await c.req.json());
    if (!parsed.success) throw new ValidationError("Invalid product.", parsed.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const storeId = await resolveStoreId(c);
    const productId = routeParam(c, "productId");
    const product = await new ProductService(db).update(storeId, productId, parsed.data);
    const actor = actorFromAuth(c.get("auth"));
    await writeAuditLog(db, {
      storeId,
      actorUserId: actor.actorUserId,
      action: AUDIT_ACTIONS.PRODUCT_UPDATE,
      resourceType: "product",
      resourceId: productId,
    });
    return sendSuccess(c, product, { message: SUCCESS_MESSAGES.PRODUCT_UPDATED });
  });

  app.delete(path("/products/:productId"), async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const storeId = await resolveStoreId(c);
    const productId = routeParam(c, "productId");
    await new ProductService(db).remove(storeId, productId);
    const actor = actorFromAuth(c.get("auth"));
    await writeAuditLog(db, {
      storeId,
      actorUserId: actor.actorUserId,
      action: AUDIT_ACTIONS.PRODUCT_DELETE,
      resourceType: "product",
      resourceId: productId,
    });
    return sendSuccess(c, { deleted: true }, { message: SUCCESS_MESSAGES.PRODUCT_DELETED });
  });

  app.get(path("/products/:productId/variants"), async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const storeId = await resolveStoreId(c);
    const product = await new ProductService(db).getForStore(storeId, routeParam(c, "productId"));
    if (product.source === "GLOBAL") {
      const { GlobalCatalogService } = await import("@/modules/global-catalog");
      const variants = await new GlobalCatalogService(db).listVariants(product.id);
      return sendSuccess(
        c,
        variants.map((v) => ({
          id: v.id,
          storeId,
          productId: v.productId,
          sku: v.sku,
          title: v.title,
          pricePaise: v.pricePaise,
          compareAtPricePaise: v.compareAtPricePaise,
          status: v.status,
          createdAt: v.createdAt,
          updatedAt: v.updatedAt,
          source: "GLOBAL" as const,
        })),
        { message: SUCCESS_MESSAGES.VARIANTS_RETRIEVED },
      );
    }
    const variants = await new VariantRepository(db).listByProduct(storeId, product.id);
    return sendSuccess(c, variants.map((v) => toVariantResponse(v)), {
      message: SUCCESS_MESSAGES.VARIANTS_RETRIEVED,
    });
  });

  app.post(path("/products/:productId/variants"), async (c) => {
    const parsed = variantBody.safeParse(await c.req.json());
    if (!parsed.success) throw new ValidationError("Invalid variant.", parsed.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const storeId = await resolveStoreId(c);
    await new ProductService(db).assertStoreMutable(storeId, routeParam(c, "productId"));
    await new ProductService(db).getForStore(storeId, routeParam(c, "productId"));
    const repo = new VariantRepository(db);
    const { initialQuantity = 0, ...variantInput } = parsed.data;
    const existing = await repo.findBySku(storeId, variantInput.sku);
    if (existing) throw new DuplicateResourceError("SKU already exists.");
    const variant = await repo.create(storeId, routeParam(c, "productId"), variantInput);
    await db.insert(inventory).values({
      storeId,
      variantId: variant.id,
      availableQuantity: initialQuantity,
      reservedQuantity: 0,
    });
    if (initialQuantity > 0) {
      await db.insert(inventoryMovements).values({
        storeId,
        variantId: variant.id,
        type: "ADJUSTMENT",
        quantity: initialQuantity,
        reference: "Initial stock on variant create",
      });
    }
    return sendSuccess(c, toVariantResponse(variant), {
      message: SUCCESS_MESSAGES.VARIANT_CREATED,
      status: HTTP_STATUS.CREATED,
    });
  });

  app.patch(path("/products/:productId/variants/:variantId"), async (c) => {
    const parsed = variantBody.omit({ initialQuantity: true }).partial().safeParse(await c.req.json());
    if (!parsed.success) throw new ValidationError("Invalid variant.", parsed.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const storeId = await resolveStoreId(c);
    await new ProductService(db).assertStoreMutable(storeId, routeParam(c, "productId"));
    const variant = await new VariantRepository(db).update(
      storeId,
      routeParam(c, "variantId"),
      parsed.data,
    );
    if (!variant) throw new NotFoundError("Variant not found.");
    return sendSuccess(c, toVariantResponse(variant), {
      message: SUCCESS_MESSAGES.VARIANT_UPDATED,
    });
  });

  app.delete(path("/products/:productId/variants/:variantId"), async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const storeId = await resolveStoreId(c);
    await new ProductService(db).assertStoreMutable(storeId, routeParam(c, "productId"));
    const deleted = await new VariantRepository(db).delete(storeId, routeParam(c, "variantId"));
    if (!deleted) throw new NotFoundError("Variant not found.");
    return sendSuccess(c, { deleted: true }, { message: SUCCESS_MESSAGES.VARIANT_DELETED });
  });

  if (options?.includeCategoryList) {
    app.get(path("/categories"), async (c) => {
      const { db, opened } = await useRequestDb(c);
      if (opened) scheduleDbClose(c, opened);
      const storeId = await resolveStoreId(c);
      const items = await db.query.categories.findMany({
        where: eq(categories.storeId, storeId),
        orderBy: [desc(categories.createdAt)],
      });
      return sendSuccess(c, items, { message: SUCCESS_MESSAGES.CATEGORIES_RETRIEVED });
    });
  }

  app.get(path("/products/:productId/media"), async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const storeId = await resolveStoreId(c);
    const product = await new ProductService(db).getForStore(storeId, routeParam(c, "productId"));
    if (product.source === "GLOBAL") {
      const { GlobalCatalogService } = await import("@/modules/global-catalog");
      const images = await new GlobalCatalogService(db).listImages(product.id);
      return sendSuccess(c, images, { message: SUCCESS_MESSAGES.MEDIA_RETRIEVED });
    }
    const { MediaService } = await import("@/modules/media/media.service");
    const images = await new MediaService(db).listByProduct(storeId, product.id);
    return sendSuccess(c, images, { message: SUCCESS_MESSAGES.MEDIA_RETRIEVED });
  });

  app.post(path("/media/upload"), async (c) => {
    const storeId = await resolveStoreId(c);
    const bucket = c.env.PRODUCT_MEDIA;
    if (!bucket) throw new ValidationError("Media storage is not configured.");

    const form = await c.req.parseBody();
    const productId = typeof form.productId === "string" ? form.productId : "";
    const file = form.file;
    if (!productId || !(file instanceof File)) {
      throw new ValidationError("productId and file are required.");
    }

    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    await new ProductService(db).assertStoreMutable(storeId, productId);
    await new ProductService(db).getForStore(storeId, productId);

    const {
      buildProductMediaKey,
      putObject,
      resolveMediaContentType,
      toR2Url,
    } = await import("@/infrastructure/r2/product-media");
    const storageKey = buildProductMediaKey({
      storeId,
      productId,
      filename: file.name || "upload.bin",
    });
    const bytes = await file.arrayBuffer();
    const contentType = resolveMediaContentType(file.type, bytes);
    await putObject(bucket, storageKey, bytes, contentType);

    const { MediaService } = await import("@/modules/media/media.service");
    const altText = typeof form.altText === "string" ? form.altText : null;
    const media = await new MediaService(db).create(storeId, productId, {
      storageKey,
      url: toR2Url(storageKey),
      altText,
    });
    return sendSuccess(c, media, {
      message: SUCCESS_MESSAGES.MEDIA_UPLOADED,
      status: HTTP_STATUS.CREATED,
    });
  });

  app.get(path("/media/:mediaId"), async (c) => {
    const storeId = await resolveStoreId(c);
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const { MediaService } = await import("@/modules/media/media.service");
    const media = await new MediaService(db).getById(storeId, routeParam(c, "mediaId"));
    const bucket = c.env.PRODUCT_MEDIA;
    if (!bucket) throw new NotFoundError("Media storage is not configured.");
    const { getObject, readObjectBytes, resolveMediaContentType } = await import(
      "@/infrastructure/r2/product-media"
    );
    const object = await getObject(bucket, media.storageKey);
    if (!object) throw new NotFoundError("Media object not found.");
    const bytes = await readObjectBytes(object);
    if (!bytes) throw new NotFoundError("Media object not found.");
    const contentType = resolveMediaContentType(object.httpMetadata?.contentType, bytes);
    return new Response(bytes, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=60",
      },
    });
  });

  app.post(path("/media/:mediaId/thumbnail"), async (c) => {
    const storeId = await resolveStoreId(c);
    const body = z
      .object({ isThumbnail: z.boolean().optional().default(true) })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) throw new ValidationError("Invalid body.", body.error.flatten());

    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const { MediaService } = await import("@/modules/media/media.service");
    const media = await new MediaService(db).setThumbnail(
      storeId,
      routeParam(c, "mediaId"),
      body.data.isThumbnail,
    );
    return sendSuccess(c, media, { message: SUCCESS_MESSAGES.MEDIA_THUMBNAIL_UPDATED });
  });

  app.patch(path("/media/:mediaId"), async (c) => {
    const storeId = await resolveStoreId(c);
    const body = z
      .object({
        altText: z.string().trim().max(500).nullable().optional(),
        sortOrder: z.number().int().nonnegative().optional(),
        swapWithMediaId: z.string().uuid().optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) throw new ValidationError("Invalid media update.", body.error.flatten());
    if (
      body.data.altText === undefined &&
      body.data.sortOrder === undefined &&
      body.data.swapWithMediaId === undefined
    ) {
      throw new ValidationError("Provide altText, sortOrder, or swapWithMediaId.");
    }

    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const { MediaService } = await import("@/modules/media/media.service");
    const service = new MediaService(db);

    if (body.data.swapWithMediaId) {
      await service.swapSortOrder(storeId, routeParam(c, "mediaId"), body.data.swapWithMediaId);
      const media = await service.getById(storeId, routeParam(c, "mediaId"));
      return sendSuccess(c, media, { message: SUCCESS_MESSAGES.MEDIA_UPDATED });
    }

    const media = await service.update(storeId, routeParam(c, "mediaId"), {
      altText: body.data.altText,
      sortOrder: body.data.sortOrder,
    });
    return sendSuccess(c, media, { message: SUCCESS_MESSAGES.MEDIA_UPDATED });
  });

  app.delete(path("/media/:mediaId"), async (c) => {
    const storeId = await resolveStoreId(c);
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const { MediaService } = await import("@/modules/media/media.service");
    const media = await new MediaService(db).remove(storeId, routeParam(c, "mediaId"));
    if (c.env.PRODUCT_MEDIA && media.storageKey) {
      const { deleteObject } = await import("@/infrastructure/r2/product-media");
      await deleteObject(c.env.PRODUCT_MEDIA, media.storageKey);
    }
    return sendSuccess(c, { deleted: true }, { message: SUCCESS_MESSAGES.MEDIA_DELETED });
  });
}
