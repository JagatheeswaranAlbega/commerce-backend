import { Hono } from "hono";
import { z } from "zod";
import { scheduleDbClose, useRequestDb } from "@/middleware/database";
import { AUDIT_ACTIONS, actorFromAuth, writeAuditLog } from "@/modules/audit";
import {
  GlobalCatalogService,
  createGlobalCategoryBodySchema,
  createGlobalProductBodySchema,
  createGlobalVariantBodySchema,
  listGlobalCategoriesQuerySchema,
  listGlobalProductsQuerySchema,
  updateGlobalCategoryBodySchema,
  updateGlobalProductBodySchema,
  updateGlobalVariantBodySchema,
} from "@/modules/global-catalog";
import { HTTP_STATUS } from "@/shared/constants/http";
import { SUCCESS_MESSAGES } from "@/shared/constants/success-messages";
import { ValidationError } from "@/shared/errors/app-error";
import { sendSuccess } from "@/shared/response/success";
import type { AppEnv } from "@/shared/types/hono";

export function registerPlatformGlobalCatalogRoutes(app: Hono<AppEnv>) {
  app.get("/global-categories", async (c) => {
    const parsed = listGlobalCategoriesQuerySchema.safeParse(c.req.query());
    if (!parsed.success) throw new ValidationError("Invalid query.", parsed.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const items = await new GlobalCatalogService(db).listCategories(parsed.data.status);
    return sendSuccess(c, items, { message: SUCCESS_MESSAGES.GLOBAL_CATEGORIES_RETRIEVED });
  });

  app.post("/global-categories", async (c) => {
    const parsed = createGlobalCategoryBodySchema.safeParse(await c.req.json());
    if (!parsed.success) throw new ValidationError("Invalid category.", parsed.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const category = await new GlobalCatalogService(db).createCategory(parsed.data);
    const actor = actorFromAuth(c.get("auth"));
    await writeAuditLog(db, {
      ...actor,
      action: AUDIT_ACTIONS.GLOBAL_CATEGORY_CREATE,
      resourceType: "global_category",
      resourceId: category.id,
    });
    return sendSuccess(c, category, {
      message: SUCCESS_MESSAGES.GLOBAL_CATEGORY_CREATED,
      status: HTTP_STATUS.CREATED,
    });
  });

  app.get("/global-categories/:categoryId", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const category = await new GlobalCatalogService(db).getCategory(c.req.param("categoryId"));
    return sendSuccess(c, category, { message: SUCCESS_MESSAGES.GLOBAL_CATEGORY_RETRIEVED });
  });

  app.patch("/global-categories/:categoryId", async (c) => {
    const parsed = updateGlobalCategoryBodySchema.safeParse(await c.req.json());
    if (!parsed.success) throw new ValidationError("Invalid category update.", parsed.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const category = await new GlobalCatalogService(db).updateCategory(
      c.req.param("categoryId"),
      parsed.data,
    );
    return sendSuccess(c, category, { message: SUCCESS_MESSAGES.GLOBAL_CATEGORY_UPDATED });
  });

  app.delete("/global-categories/:categoryId", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const categoryId = c.req.param("categoryId");
    await new GlobalCatalogService(db).removeCategory(categoryId);
    const actor = actorFromAuth(c.get("auth"));
    await writeAuditLog(db, {
      ...actor,
      action: AUDIT_ACTIONS.GLOBAL_CATEGORY_DELETE,
      resourceType: "global_category",
      resourceId: categoryId,
    });
    return sendSuccess(c, { id: categoryId }, { message: SUCCESS_MESSAGES.GLOBAL_CATEGORY_DELETED });
  });

  app.get("/global-products", async (c) => {
    const parsed = listGlobalProductsQuerySchema.safeParse(c.req.query());
    if (!parsed.success) throw new ValidationError("Invalid query.", parsed.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const result = await new GlobalCatalogService(db).listProducts(parsed.data);
    return sendSuccess(c, result.items, {
      message: SUCCESS_MESSAGES.GLOBAL_PRODUCTS_RETRIEVED,
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / result.pageSize) || 1,
      },
    });
  });

  app.post("/global-products", async (c) => {
    const parsed = createGlobalProductBodySchema.safeParse(await c.req.json());
    if (!parsed.success) throw new ValidationError("Invalid product.", parsed.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const product = await new GlobalCatalogService(db).createProduct(parsed.data);
    const actor = actorFromAuth(c.get("auth"));
    await writeAuditLog(db, {
      ...actor,
      action: AUDIT_ACTIONS.GLOBAL_PRODUCT_CREATE,
      resourceType: "global_product",
      resourceId: product.id,
    });
    return sendSuccess(c, product, {
      message: SUCCESS_MESSAGES.GLOBAL_PRODUCT_CREATED,
      status: HTTP_STATUS.CREATED,
    });
  });

  app.get("/global-products/:productId", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const product = await new GlobalCatalogService(db).getProduct(c.req.param("productId"));
    return sendSuccess(c, product, { message: SUCCESS_MESSAGES.GLOBAL_PRODUCT_RETRIEVED });
  });

  app.patch("/global-products/:productId", async (c) => {
    const parsed = updateGlobalProductBodySchema.safeParse(await c.req.json());
    if (!parsed.success) throw new ValidationError("Invalid product update.", parsed.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const product = await new GlobalCatalogService(db).updateProduct(
      c.req.param("productId"),
      parsed.data,
    );
    return sendSuccess(c, product, { message: SUCCESS_MESSAGES.GLOBAL_PRODUCT_UPDATED });
  });

  app.delete("/global-products/:productId", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const productId = c.req.param("productId");
    await new GlobalCatalogService(db).removeProduct(productId);
    const actor = actorFromAuth(c.get("auth"));
    await writeAuditLog(db, {
      ...actor,
      action: AUDIT_ACTIONS.GLOBAL_PRODUCT_DELETE,
      resourceType: "global_product",
      resourceId: productId,
    });
    return sendSuccess(c, { id: productId }, { message: SUCCESS_MESSAGES.GLOBAL_PRODUCT_DELETED });
  });

  app.get("/global-products/:productId/variants", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const variants = await new GlobalCatalogService(db).listVariants(c.req.param("productId"));
    return sendSuccess(c, variants, { message: SUCCESS_MESSAGES.VARIANTS_RETRIEVED });
  });

  app.post("/global-products/:productId/variants", async (c) => {
    const parsed = createGlobalVariantBodySchema.safeParse(await c.req.json());
    if (!parsed.success) throw new ValidationError("Invalid variant.", parsed.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const variant = await new GlobalCatalogService(db).createVariant(
      c.req.param("productId"),
      parsed.data,
    );
    return sendSuccess(c, variant, {
      message: SUCCESS_MESSAGES.GLOBAL_VARIANT_CREATED,
      status: HTTP_STATUS.CREATED,
    });
  });

  app.patch("/global-products/:productId/variants/:variantId", async (c) => {
    const parsed = updateGlobalVariantBodySchema.safeParse(await c.req.json());
    if (!parsed.success) throw new ValidationError("Invalid variant update.", parsed.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const variant = await new GlobalCatalogService(db).updateVariant(
      c.req.param("productId"),
      c.req.param("variantId"),
      parsed.data,
    );
    return sendSuccess(c, variant, { message: SUCCESS_MESSAGES.GLOBAL_VARIANT_UPDATED });
  });

  app.delete("/global-products/:productId/variants/:variantId", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    await new GlobalCatalogService(db).removeVariant(
      c.req.param("productId"),
      c.req.param("variantId"),
    );
    return sendSuccess(
      c,
      { id: c.req.param("variantId") },
      { message: SUCCESS_MESSAGES.GLOBAL_VARIANT_DELETED },
    );
  });

  app.get("/global-products/:productId/media", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const images = await new GlobalCatalogService(db).listImages(c.req.param("productId"));
    return sendSuccess(c, images, { message: SUCCESS_MESSAGES.MEDIA_RETRIEVED });
  });

  app.post("/global-media/upload", async (c) => {
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
    await new GlobalCatalogService(db).getProduct(productId);

    const {
      buildProductMediaKey,
      putObject,
      resolveMediaContentType,
      toR2Url,
    } = await import("@/infrastructure/r2/product-media");
    const storageKey = buildProductMediaKey({
      storeId: null,
      productId,
      filename: file.name || "upload.bin",
    });
    const bytes = await file.arrayBuffer();
    const contentType = resolveMediaContentType(file.type, bytes);
    await putObject(bucket, storageKey, bytes, contentType);

    const altText = typeof form.altText === "string" ? form.altText : null;
    const media = await new GlobalCatalogService(db).createImage(productId, {
      storageKey,
      url: toR2Url(storageKey),
      altText,
    });
    return sendSuccess(c, media, {
      message: SUCCESS_MESSAGES.MEDIA_UPLOADED,
      status: HTTP_STATUS.CREATED,
    });
  });

  app.post("/global-media/:mediaId/thumbnail", async (c) => {
    const body = z
      .object({
        productId: z.string().uuid(),
        isThumbnail: z.boolean().optional().default(true),
      })
      .safeParse(await c.req.json());
    if (!body.success) throw new ValidationError("productId is required.", body.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const media = await new GlobalCatalogService(db).setThumbnail(
      body.data.productId,
      c.req.param("mediaId"),
      body.data.isThumbnail,
    );
    return sendSuccess(c, media, { message: SUCCESS_MESSAGES.MEDIA_THUMBNAIL_UPDATED });
  });

  app.delete("/global-media/:mediaId", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const media = await new GlobalCatalogService(db).removeImage(c.req.param("mediaId"));
    if (c.env.PRODUCT_MEDIA && media.storageKey) {
      const { deleteObject } = await import("@/infrastructure/r2/product-media");
      await deleteObject(c.env.PRODUCT_MEDIA, media.storageKey);
    }
    return sendSuccess(c, { id: media.id }, { message: SUCCESS_MESSAGES.MEDIA_DELETED });
  });

  app.get("/global-media/:mediaId", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const service = new GlobalCatalogService(db);
    // Resolve via delete-path lookup: list isn't by media id alone; use remove's find
    const { GlobalCatalogRepository } = await import(
      "@/modules/global-catalog/global-catalog.repository"
    );
    const image = await new GlobalCatalogRepository(db).findImageById(c.req.param("mediaId"));
    if (!image) {
      const { NotFoundError } = await import("@/shared/errors/app-error");
      throw new NotFoundError("Global product image not found.");
    }
    if (!c.env.PRODUCT_MEDIA) throw new ValidationError("Media storage is not configured.");
    const { getObject } = await import("@/infrastructure/r2/product-media");
    const object = await getObject(c.env.PRODUCT_MEDIA, image.storageKey);
    if (!object?.body) {
      const { NotFoundError } = await import("@/shared/errors/app-error");
      throw new NotFoundError("Media object not found.");
    }
    void service;
    return new Response(object.body, {
      headers: {
        "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
      },
    });
  });
}
