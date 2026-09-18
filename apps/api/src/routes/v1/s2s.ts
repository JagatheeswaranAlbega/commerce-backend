import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { requireSecretKey } from "@/middleware/require-storefront";
import { scheduleDbClose, useRequestDb } from "@/middleware/database";
import { ProductService } from "@/modules/product/product.service";
import { listStorefrontProductsQuerySchema } from "@/modules/product/product.schemas";
import { VariantRepository } from "@/modules/variant/variant.repository";
import { toVariantResponse } from "@/modules/variant/variant.types";
import { stores } from "@/db/schema/stores";
import { storeSettings } from "@/db/schema/store-settings";
import { inventory } from "@/db/schema/inventory";
import { orders } from "@/db/schema/orders";
import { sendSuccess } from "@/shared/response/success";
import { SUCCESS_MESSAGES } from "@/shared/constants/success-messages";
import { InvalidSecretKeyError, NotFoundError, ValidationError } from "@/shared/errors/app-error";
import type { AppEnv } from "@/shared/types/hono";

function storeId(c: { get: (k: "auth") => { storeId?: string | null } | undefined }) {
  const id = c.get("auth")?.storeId;
  if (!id) throw new InvalidSecretKeyError();
  return id;
}

/**
 * Server-to-server read surface authenticated with `Authorization: Bearer sk_live_...`.
 */
export function createS2sRoutes() {
  const app = new Hono<AppEnv>();
  app.use("*", requireSecretKey());

  app.get("/details", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const sid = storeId(c);
    const store = await db.query.stores.findFirst({ where: eq(stores.id, sid) });
    if (!store) throw new NotFoundError("Store not found.");
    const settings = await db.query.storeSettings.findMany({
      where: eq(storeSettings.storeId, sid),
    });
    const map = Object.fromEntries(settings.map((item) => [item.key, item.value]));
    const asText = (value: unknown) =>
      typeof value === "string" && value.trim() ? value.trim() : null;
    return sendSuccess(
      c,
      {
        id: store.id,
        name: store.name,
        slug: store.slug,
        status: store.status,
        domain: asText(map.domain),
        contactEmail: asText(map.contactEmail),
        currency: asText(map.currency) ?? "INR",
        timezone: asText(map.timezone) ?? "Asia/Kolkata",
        accessType: "SECRET_KEY",
      },
      { message: SUCCESS_MESSAGES.STORE_RETRIEVED },
    );
  });

  app.get("/products", async (c) => {
    const parsed = listStorefrontProductsQuerySchema.safeParse(c.req.query());
    if (!parsed.success) throw new ValidationError("Invalid query.", parsed.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const sid = storeId(c);
    const result = await new ProductService(db).listCatalog(sid, parsed.data);
    const { MediaService } = await import("@/modules/media/media.service");
    const thumbnails = await new MediaService(db).thumbnailsForProducts(
      sid,
      result.items.map((item) => item.id),
    );
    const items = result.items.map((item) => {
      const thumb = thumbnails.get(item.id);
      return {
        ...item,
        thumbnail: thumb
          ? {
              id: thumb.id,
              altText: thumb.altText,
              src: `/api/v1/store/media/${thumb.id}`,
            }
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

  app.get("/products/:handle", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const sid = storeId(c);
    const product = await new ProductService(db).getCatalogByHandle(sid, c.req.param("handle"));
    const variants = await new VariantRepository(db).listByProduct(sid, product.id);
    const stocks = await db.query.inventory.findMany({
      where: and(eq(inventory.storeId, sid)),
    });
    const stockByVariant = new Map(stocks.map((s) => [s.variantId, s.availableQuantity]));
    const { MediaService } = await import("@/modules/media/media.service");
    const images = await new MediaService(db).listByProduct(sid, product.id);
    return sendSuccess(
      c,
      {
        ...product,
        variants: variants.map((v) => ({
          ...toVariantResponse(v),
          availableQuantity: stockByVariant.get(v.id) ?? 0,
        })),
        images: images.map((image) => ({
          ...image,
          src: `/api/v1/store/media/${image.id}`,
        })),
        thumbnail: images[0]
          ? {
              id: images[0].id,
              altText: images[0].altText,
              src: `/api/v1/store/media/${images[0].id}`,
            }
          : null,
      },
      { message: SUCCESS_MESSAGES.PRODUCT_RETRIEVED },
    );
  });

  app.get("/orders/:orderId", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, c.req.param("orderId")), eq(orders.storeId, storeId(c))),
      with: { items: true },
    });
    if (!order) throw new NotFoundError("Order not found.");
    return sendSuccess(c, order, { message: SUCCESS_MESSAGES.ORDER_RETRIEVED });
  });

  return app;
}
