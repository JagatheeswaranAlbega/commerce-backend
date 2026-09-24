import { Hono } from "hono";
import { scheduleDbClose, useRequestDb } from "@/middleware/database";
import { AUDIT_ACTIONS, actorFromAuth, writeAuditLog } from "@/modules/audit";
import {
  bulkImportGlobalProductsBodySchema,
  GlobalCatalogService,
  listGlobalCategoriesQuerySchema,
  listGlobalProductsQuerySchema,
} from "@/modules/global-catalog";
import { HTTP_STATUS } from "@/shared/constants/http";
import { SUCCESS_MESSAGES } from "@/shared/constants/success-messages";
import { NotFoundError, ValidationError } from "@/shared/errors/app-error";
import { sendSuccess } from "@/shared/response/success";
import type { AppEnv } from "@/shared/types/hono";

function storeIdFromAuth(c: { get: (k: "auth") => { storeId?: string | null } | undefined }) {
  const storeId = c.get("auth")?.storeId;
  if (!storeId) throw new ValidationError("Store context is required.");
  return storeId;
}

export function registerAdminGlobalCatalogRoutes(app: Hono<AppEnv>) {
  app.get("/global-catalog/categories", async (c) => {
    const parsed = listGlobalCategoriesQuerySchema.safeParse(c.req.query());
    if (!parsed.success) throw new ValidationError("Invalid query.", parsed.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const items = await new GlobalCatalogService(db).listCategories(parsed.data.status);
    return sendSuccess(c, items, { message: SUCCESS_MESSAGES.GLOBAL_CATEGORIES_RETRIEVED });
  });

  app.get("/global-catalog/categories/:categoryId", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const category = await new GlobalCatalogService(db).getCategory(c.req.param("categoryId"));
    return sendSuccess(c, category, { message: SUCCESS_MESSAGES.GLOBAL_CATEGORY_RETRIEVED });
  });

  app.get("/global-catalog/products", async (c) => {
    const parsed = listGlobalProductsQuerySchema.safeParse(c.req.query());
    if (!parsed.success) throw new ValidationError("Invalid query.", parsed.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const storeId = storeIdFromAuth(c);
    const result = await new GlobalCatalogService(db).listProducts(parsed.data, storeId);
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

  app.post("/global-catalog/products/import", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = bulkImportGlobalProductsBodySchema.safeParse(body);
    if (!parsed.success) throw new ValidationError("Invalid body.", parsed.error.flatten());

    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const storeId = storeIdFromAuth(c);
    const result = await new GlobalCatalogService(db).importManyToStore(
      storeId,
      parsed.data.productIds,
    );

    const actor = actorFromAuth(c.get("auth"));
    for (const item of result.imported) {
      await writeAuditLog(db, {
        ...actor,
        storeId,
        action: AUDIT_ACTIONS.GLOBAL_PRODUCT_IMPORT,
        resourceType: "global_product",
        resourceId: item.id,
      });
    }

    const message =
      result.failedCount === 0
        ? SUCCESS_MESSAGES.GLOBAL_PRODUCTS_IMPORTED
        : result.importedCount === 0
          ? SUCCESS_MESSAGES.GLOBAL_PRODUCTS_IMPORT_NONE
          : `Imported ${result.importedCount} of ${result.importedCount + result.failedCount} products`;

    return sendSuccess(c, result, {
      message,
      status: result.importedCount > 0 ? HTTP_STATUS.CREATED : HTTP_STATUS.OK,
    });
  });

  app.get("/global-catalog/products/:productId", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const storeId = storeIdFromAuth(c);
    const product = await new GlobalCatalogService(db).getProduct(
      c.req.param("productId"),
      storeId,
    );
    return sendSuccess(c, product, { message: SUCCESS_MESSAGES.GLOBAL_PRODUCT_RETRIEVED });
  });

  app.post("/global-catalog/products/:productId/import", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const storeId = storeIdFromAuth(c);
    const productId = c.req.param("productId");
    const result = await new GlobalCatalogService(db).importToStore(storeId, productId);
    const actor = actorFromAuth(c.get("auth"));
    await writeAuditLog(db, {
      ...actor,
      storeId,
      action: AUDIT_ACTIONS.GLOBAL_PRODUCT_IMPORT,
      resourceType: "global_product",
      resourceId: productId,
    });
    return sendSuccess(c, result, {
      message: SUCCESS_MESSAGES.GLOBAL_PRODUCT_IMPORTED,
      status: HTTP_STATUS.CREATED,
    });
  });

  app.delete("/global-catalog/products/:productId/import", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const storeId = storeIdFromAuth(c);
    const productId = c.req.param("productId");
    await new GlobalCatalogService(db).removeFromStore(storeId, productId);
    const actor = actorFromAuth(c.get("auth"));
    await writeAuditLog(db, {
      ...actor,
      storeId,
      action: AUDIT_ACTIONS.GLOBAL_PRODUCT_REMOVE,
      resourceType: "global_product",
      resourceId: productId,
    });
    return sendSuccess(c, { id: productId }, { message: SUCCESS_MESSAGES.GLOBAL_PRODUCT_REMOVED });
  });

  app.get("/global-media/:mediaId", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const { GlobalCatalogRepository } = await import(
      "@/modules/global-catalog/global-catalog.repository"
    );
    const image = await new GlobalCatalogRepository(db).findImageById(c.req.param("mediaId"));
    if (!image) throw new NotFoundError("Media not found.");
    const bucket = c.env.PRODUCT_MEDIA;
    if (!bucket) throw new NotFoundError("Media storage is not configured.");
    const { getObject, readObjectBytes, resolveMediaContentType } = await import(
      "@/infrastructure/r2/product-media"
    );
    const object = await getObject(bucket, image.storageKey);
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
}
