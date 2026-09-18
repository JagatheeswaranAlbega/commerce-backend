import { Hono } from "hono";
import { z } from "zod";
import { and, count, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import {
  DEFAULT_SHIPPING_SETTINGS,
  DEFAULT_TAX_SETTINGS,
} from "@/modules/checkout/totals";
import { requireStoreAdmin } from "@/middleware/require-admin";
import { scheduleDbClose, useRequestDb } from "@/middleware/database";
import { ProductService } from "@/modules/product/product.service";
import {
  createProductBodySchema,
  listProductsQuerySchema,
  updateProductBodySchema,
} from "@/modules/product/product.schemas";
import { VariantRepository } from "@/modules/variant/variant.repository";
import { toVariantResponse } from "@/modules/variant/variant.types";
import { normalizeDiscountCode } from "@/modules/discount";
import { AUDIT_ACTIONS, actorFromAuth, writeAuditLog } from "@/modules/audit";
import {
  assertOrderCanRequestReturn,
  assertReturnIsRequested,
  findBlockingReturn,
  restoreOrderStock,
} from "@/modules/returns";
import { categories } from "@/db/schema/categories";
import { collections } from "@/db/schema/collections";
import { discounts } from "@/db/schema/discounts";
import { inventory } from "@/db/schema/inventory";
import { inventoryMovements } from "@/db/schema/inventory-movements";
import { orderReturns } from "@/db/schema/order-returns";
import { orders } from "@/db/schema/orders";
import { customers } from "@/db/schema/customers";
import { customerAddresses } from "@/db/schema/customer-addresses";
import { productImages } from "@/db/schema/product-images";
import { productVariants } from "@/db/schema/product-variants";
import { products } from "@/db/schema/products";
import { storeSettings } from "@/db/schema/store-settings";
import { stores } from "@/db/schema/stores";
import { CollectionService } from "@/modules/collection/collection.service";
import { StoreService } from "@/modules/store/store.service";
import {
  buildSalesCsv,
  loadSalesReport,
  loadSalesReportExportRows,
  parseSalesReportRange,
} from "@/modules/reports";
import { sendSuccess } from "@/shared/response/success";
import {
  DuplicateResourceError,
  InvalidStateError,
  NotFoundError,
  StoreNotFoundError,
  ValidationError,
} from "@/shared/errors/app-error";
import { HTTP_STATUS } from "@/shared/constants/http";
import { SUCCESS_MESSAGES } from "@/shared/constants/success-messages";
import { paginationQuerySchema } from "@/shared/pagination/pagination.schema";
import { buildPaginationMeta, paginationOffset } from "@/shared/pagination/pagination";
import type { AppEnv } from "@/shared/types/hono";

const STOCK_RESTORABLE_STATUSES = new Set([
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
]);
const STOCK_RETURN_STATUSES = new Set(["CANCELLED", "REFUNDED"]);

function storeIdFromAuth(c: { get: (k: "auth") => { storeId?: string | null } | undefined }) {
  const storeId = c.get("auth")?.storeId;
  if (!storeId) throw new ValidationError("Store scope missing.");
  return storeId;
}

const updateAdminSettingsSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  domain: z.string().trim().max(255).nullable().or(z.literal("")).optional(),
  contactEmail: z
    .string()
    .trim()
    .email()
    .nullable()
    .or(z.literal(""))
    .optional(),
  currency: z.string().trim().min(1).max(10).optional(),
  timezone: z.string().trim().min(1).max(100).optional(),
  shipping: z
    .object({
      mode: z.enum(["flat", "free_over", "off"]),
      flatPaise: z.number().int().min(0),
      freeOverPaise: z.number().int().min(0).nullable().optional(),
    })
    .optional(),
  tax: z
    .object({
      gstPercent: z.number().min(0).max(100),
      gstin: z.string().trim().max(20).nullable().optional(),
    })
    .optional(),
});

function textSetting(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toAdminStoreSettingsDto(
  store: { name: string; slug: string; status: string },
  items: { key: string; value: unknown }[],
) {
  const map = Object.fromEntries(items.map((item) => [item.key, item.value]));
  const shipping =
    map.shipping && typeof map.shipping === "object" && !Array.isArray(map.shipping)
      ? {
          mode:
            (map.shipping as { mode?: string }).mode === "free_over" ||
            (map.shipping as { mode?: string }).mode === "off" ||
            (map.shipping as { mode?: string }).mode === "flat"
              ? ((map.shipping as { mode: "flat" | "free_over" | "off" }).mode)
              : DEFAULT_SHIPPING_SETTINGS.mode,
          flatPaise:
            typeof (map.shipping as { flatPaise?: number }).flatPaise === "number"
              ? Math.max(0, Math.floor((map.shipping as { flatPaise: number }).flatPaise))
              : DEFAULT_SHIPPING_SETTINGS.flatPaise,
          freeOverPaise:
            typeof (map.shipping as { freeOverPaise?: number | null }).freeOverPaise === "number"
              ? Math.max(0, Math.floor((map.shipping as { freeOverPaise: number }).freeOverPaise))
              : null,
        }
      : { ...DEFAULT_SHIPPING_SETTINGS, freeOverPaise: null };
  const tax =
    map.tax && typeof map.tax === "object" && !Array.isArray(map.tax)
      ? {
          gstPercent:
            typeof (map.tax as { gstPercent?: number }).gstPercent === "number"
              ? Math.max(0, (map.tax as { gstPercent: number }).gstPercent)
              : DEFAULT_TAX_SETTINGS.gstPercent,
          gstin:
            typeof (map.tax as { gstin?: string | null }).gstin === "string" &&
            (map.tax as { gstin: string }).gstin.trim().length > 0
              ? (map.tax as { gstin: string }).gstin.trim()
              : null,
        }
      : { ...DEFAULT_TAX_SETTINGS, gstin: null };
  return {
    name: store.name,
    slug: store.slug,
    status: store.status,
    domain: textSetting(map.domain),
    contactEmail: textSetting(map.contactEmail),
    currency: textSetting(map.currency) ?? "INR",
    timezone: textSetting(map.timezone) ?? "Asia/Kolkata",
    shipping,
    tax,
  };
}

export function createAdminRoutes() {
  const app = new Hono<AppEnv>();
  app.use("*", requireStoreAdmin());

  app.get("/products", async (c) => {
    const parsed = listProductsQuerySchema.safeParse(c.req.query());
    if (!parsed.success) throw new ValidationError("Invalid query.", parsed.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const storeId = storeIdFromAuth(c);
    const result = await new ProductService(db).listForStore(storeId, parsed.data);
    const { MediaService } = await import("@/modules/media/media.service");
    const thumbnails = await new MediaService(db).thumbnailsForProducts(
      storeId,
      result.items.map((item) => item.id),
    );
    const items = result.items.map((item) => {
      const thumb = thumbnails.get(item.id);
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

  app.post("/products", async (c) => {
    const parsed = createProductBodySchema.safeParse(await c.req.json());
    if (!parsed.success) throw new ValidationError("Invalid product.", parsed.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const product = await new ProductService(db).create(storeIdFromAuth(c), parsed.data);
    return sendSuccess(c, product, {
      message: SUCCESS_MESSAGES.PRODUCT_CREATED,
      status: HTTP_STATUS.CREATED,
    });
  });

  app.get("/products/:productId", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const storeId = storeIdFromAuth(c);
    const product = await new ProductService(db).getForStore(storeId, c.req.param("productId"));
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

  app.patch("/products/:productId", async (c) => {
    const parsed = updateProductBodySchema.safeParse(await c.req.json());
    if (!parsed.success) throw new ValidationError("Invalid product.", parsed.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const product = await new ProductService(db).update(
      storeIdFromAuth(c),
      c.req.param("productId"),
      parsed.data,
    );
    return sendSuccess(c, product, { message: SUCCESS_MESSAGES.PRODUCT_UPDATED });
  });

  app.delete("/products/:productId", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const storeId = storeIdFromAuth(c);
    const productId = c.req.param("productId");
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

  const variantBody = z.object({
    sku: z.string().min(1),
    title: z.string().min(1),
    pricePaise: z.number().int().nonnegative(),
    compareAtPricePaise: z.number().int().nonnegative().nullable().optional(),
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
    /** Initial on-hand qty when creating a variant (ignored on PATCH). */
    initialQuantity: z.number().int().nonnegative().optional(),
  });

  app.get("/products/:productId/variants", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const variants = await new VariantRepository(db).listByProduct(
      storeIdFromAuth(c),
      c.req.param("productId"),
    );
    return sendSuccess(c, variants.map((v) => toVariantResponse(v)), {
      message: SUCCESS_MESSAGES.VARIANTS_RETRIEVED,
    });
  });

  app.post("/products/:productId/variants", async (c) => {
    const parsed = variantBody.safeParse(await c.req.json());
    if (!parsed.success) throw new ValidationError("Invalid variant.", parsed.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const storeId = storeIdFromAuth(c);
    await new ProductService(db).getForStore(storeId, c.req.param("productId"));
    const repo = new VariantRepository(db);
    const { initialQuantity = 0, ...variantInput } = parsed.data;
    const existing = await repo.findBySku(storeId, variantInput.sku);
    if (existing) throw new DuplicateResourceError("SKU already exists.");
    const variant = await repo.create(storeId, c.req.param("productId"), variantInput);
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

  app.patch("/products/:productId/variants/:variantId", async (c) => {
    const parsed = variantBody.omit({ initialQuantity: true }).partial().safeParse(await c.req.json());
    if (!parsed.success) throw new ValidationError("Invalid variant.", parsed.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const variant = await new VariantRepository(db).update(
      storeIdFromAuth(c),
      c.req.param("variantId"),
      parsed.data,
    );
    if (!variant) throw new NotFoundError("Variant not found.");
    return sendSuccess(c, toVariantResponse(variant), {
      message: SUCCESS_MESSAGES.VARIANT_UPDATED,
    });
  });

  app.delete("/products/:productId/variants/:variantId", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const deleted = await new VariantRepository(db).delete(
      storeIdFromAuth(c),
      c.req.param("variantId"),
    );
    if (!deleted) throw new NotFoundError("Variant not found.");
    return sendSuccess(c, { deleted: true }, { message: SUCCESS_MESSAGES.VARIANT_DELETED });
  });

  // Categories
  app.get("/categories", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const items = await db.query.categories.findMany({
      where: eq(categories.storeId, storeIdFromAuth(c)),
      orderBy: [desc(categories.createdAt)],
    });
    return sendSuccess(c, items, { message: SUCCESS_MESSAGES.CATEGORIES_RETRIEVED });
  });

  app.post("/categories", async (c) => {
    const body = z
      .object({
        name: z.string().min(1),
        slug: z.string().min(1),
        parentId: z.string().uuid().nullable().optional(),
        status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) throw new ValidationError("Invalid category.", body.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const [item] = await db
      .insert(categories)
      .values({ storeId: storeIdFromAuth(c), ...body.data })
      .returning();
    return sendSuccess(c, item, {
      message: SUCCESS_MESSAGES.CATEGORY_CREATED,
      status: HTTP_STATUS.CREATED,
    });
  });

  app.patch("/categories/:categoryId", async (c) => {
    const body = z
      .object({
        name: z.string().min(1).optional(),
        slug: z.string().min(1).optional(),
        parentId: z.string().uuid().nullable().optional(),
        status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) throw new ValidationError("Invalid category.", body.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const [item] = await db
      .update(categories)
      .set({ ...body.data, updatedAt: new Date() })
      .where(
        and(eq(categories.id, c.req.param("categoryId")), eq(categories.storeId, storeIdFromAuth(c))),
      )
      .returning();
    if (!item) throw new NotFoundError("Category not found.");
    return sendSuccess(c, item, { message: SUCCESS_MESSAGES.CATEGORY_UPDATED });
  });

  app.delete("/categories/:categoryId", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const deleted = await db
      .delete(categories)
      .where(
        and(eq(categories.id, c.req.param("categoryId")), eq(categories.storeId, storeIdFromAuth(c))),
      )
      .returning({ id: categories.id });
    if (!deleted.length) throw new NotFoundError("Category not found.");
    return sendSuccess(c, { deleted: true }, { message: SUCCESS_MESSAGES.CATEGORY_DELETED });
  });

  // Collections
  app.get("/collections", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const items = await db.query.collections.findMany({
      where: eq(collections.storeId, storeIdFromAuth(c)),
    });
    return sendSuccess(c, items, { message: SUCCESS_MESSAGES.COLLECTIONS_RETRIEVED });
  });

  app.post("/collections", async (c) => {
    const body = z
      .object({
        name: z.string().min(1),
        slug: z.string().min(1),
        description: z.string().nullable().optional(),
        status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) throw new ValidationError("Invalid collection.", body.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const [item] = await db
      .insert(collections)
      .values({ storeId: storeIdFromAuth(c), ...body.data })
      .returning();
    return sendSuccess(c, item, {
      message: SUCCESS_MESSAGES.COLLECTION_CREATED,
      status: HTTP_STATUS.CREATED,
    });
  });

  app.patch("/collections/:collectionId", async (c) => {
    const body = z
      .object({
        name: z.string().min(1).optional(),
        slug: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) throw new ValidationError("Invalid collection.", body.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const [item] = await db
      .update(collections)
      .set({ ...body.data, updatedAt: new Date() })
      .where(
        and(
          eq(collections.id, c.req.param("collectionId")),
          eq(collections.storeId, storeIdFromAuth(c)),
        ),
      )
      .returning();
    if (!item) throw new NotFoundError("Collection not found.");
    return sendSuccess(c, item, { message: SUCCESS_MESSAGES.COLLECTION_UPDATED });
  });

  app.delete("/collections/:collectionId", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const deleted = await db
      .delete(collections)
      .where(
        and(
          eq(collections.id, c.req.param("collectionId")),
          eq(collections.storeId, storeIdFromAuth(c)),
        ),
      )
      .returning({ id: collections.id });
    if (!deleted.length) throw new NotFoundError("Collection not found.");
    return sendSuccess(c, { deleted: true }, { message: SUCCESS_MESSAGES.COLLECTION_DELETED });
  });

  app.get("/collections/:collectionId/products", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const items = await new CollectionService(db).listProducts(
      storeIdFromAuth(c),
      c.req.param("collectionId"),
    );
    return sendSuccess(c, items, { message: SUCCESS_MESSAGES.PRODUCTS_RETRIEVED });
  });

  app.post("/collections/:collectionId/products", async (c) => {
    const body = z.object({ productId: z.string().uuid() }).safeParse(await c.req.json());
    if (!body.success) throw new ValidationError("Invalid collection product.", body.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const product = await new CollectionService(db).addProduct(
      storeIdFromAuth(c),
      c.req.param("collectionId"),
      body.data.productId,
    );
    return sendSuccess(c, product, {
      message: SUCCESS_MESSAGES.COLLECTION_PRODUCT_ADDED,
      status: HTTP_STATUS.CREATED,
    });
  });

  app.delete("/collections/:collectionId/products/:productId", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    await new CollectionService(db).removeProduct(
      storeIdFromAuth(c),
      c.req.param("collectionId"),
      c.req.param("productId"),
    );
    return sendSuccess(c, { deleted: true }, {
      message: SUCCESS_MESSAGES.COLLECTION_PRODUCT_REMOVED,
    });
  });

  // Inventory
  app.get("/inventory", async (c) => {
    const parsed = paginationQuerySchema
      .extend({ q: z.string().trim().min(1).max(200).optional() })
      .safeParse(c.req.query());
    if (!parsed.success) throw new ValidationError("Invalid query.", parsed.error.flatten());
    const { page, pageSize, q } = parsed.data;
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const storeId = storeIdFromAuth(c);
    const clauses: SQL[] = [eq(inventory.storeId, storeId)];
    if (q) {
      const pattern = `%${q}%`;
      clauses.push(
        sql`(${ilike(products.title, pattern)} or ${ilike(productVariants.title, pattern)} or ${ilike(productVariants.sku, pattern)})`,
      );
    }
    const where = and(...clauses);
    const [rows, totalRow] = await Promise.all([
      db
        .select({
          id: inventory.id,
          variantId: inventory.variantId,
          availableQuantity: inventory.availableQuantity,
          reservedQuantity: inventory.reservedQuantity,
          updatedAt: inventory.updatedAt,
          sku: productVariants.sku,
          variantName: productVariants.title,
          productName: products.title,
          productId: products.id,
        })
        .from(inventory)
        .innerJoin(productVariants, eq(inventory.variantId, productVariants.id))
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(where)
        .orderBy(desc(inventory.updatedAt))
        .limit(pageSize)
        .offset(paginationOffset(page, pageSize)),
      db
        .select({ total: count() })
        .from(inventory)
        .innerJoin(productVariants, eq(inventory.variantId, productVariants.id))
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(where),
    ]);
    return sendSuccess(c, rows, {
      message: SUCCESS_MESSAGES.INVENTORY_RETRIEVED,
      pagination: buildPaginationMeta(page, pageSize, Number(totalRow[0]?.total ?? 0)),
    });
  });

  app.get("/inventory/:variantId", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const storeId = storeIdFromAuth(c);
    const [item] = await db
      .select({
        id: inventory.id,
        variantId: inventory.variantId,
        availableQuantity: inventory.availableQuantity,
        reservedQuantity: inventory.reservedQuantity,
        updatedAt: inventory.updatedAt,
        sku: productVariants.sku,
        variantName: productVariants.title,
        productName: products.title,
        productId: products.id,
      })
      .from(inventory)
      .innerJoin(productVariants, eq(inventory.variantId, productVariants.id))
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(and(eq(inventory.storeId, storeId), eq(inventory.variantId, c.req.param("variantId"))))
      .limit(1);
    if (!item) throw new NotFoundError("Inventory not found.");
    return sendSuccess(c, item, { message: SUCCESS_MESSAGES.INVENTORY_ITEM_RETRIEVED });
  });

  app.get("/inventory/:variantId/movements", async (c) => {
    const parsed = paginationQuerySchema.safeParse(c.req.query());
    if (!parsed.success) throw new ValidationError("Invalid query.", parsed.error.flatten());
    const { page, pageSize } = parsed.data;
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const storeId = storeIdFromAuth(c);
    const variantId = c.req.param("variantId");
    const where = and(
      eq(inventoryMovements.storeId, storeId),
      eq(inventoryMovements.variantId, variantId),
    );
    const [items, totalRow] = await Promise.all([
      db.query.inventoryMovements.findMany({
        where,
        orderBy: [desc(inventoryMovements.createdAt)],
        limit: pageSize,
        offset: paginationOffset(page, pageSize),
      }),
      db.select({ total: count() }).from(inventoryMovements).where(where),
    ]);
    return sendSuccess(c, items, {
      message: SUCCESS_MESSAGES.INVENTORY_RETRIEVED,
      pagination: buildPaginationMeta(page, pageSize, Number(totalRow[0]?.total ?? 0)),
    });
  });

  app.post("/inventory/:variantId/adjust", async (c) => {
    const body = z
      .object({
        delta: z.number().int(),
        reason: z.string().optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) throw new ValidationError("Invalid adjustment.", body.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const storeId = storeIdFromAuth(c);
    const variantId = c.req.param("variantId");
    const existing = await db.query.inventory.findFirst({
      where: and(eq(inventory.storeId, storeId), eq(inventory.variantId, variantId)),
    });
    if (!existing) throw new NotFoundError("Inventory not found.");
    const availableQuantity = existing.availableQuantity + body.data.delta;
    if (availableQuantity < 0) throw new ValidationError("Insufficient stock for adjustment.");
    const [updated] = await db
      .update(inventory)
      .set({ availableQuantity, updatedAt: new Date() })
      .where(eq(inventory.id, existing.id))
      .returning();
    await db.insert(inventoryMovements).values({
      storeId,
      variantId,
      type: "ADJUSTMENT",
      quantity: body.data.delta,
      reference: body.data.reason ?? null,
    });
    const actor = actorFromAuth(c.get("auth"));
    await writeAuditLog(db, {
      storeId,
      actorUserId: actor.actorUserId,
      action: AUDIT_ACTIONS.INVENTORY_ADJUST,
      resourceType: "inventory",
      resourceId: variantId,
      metadata: { delta: body.data.delta, reason: body.data.reason ?? null, availableQuantity },
    });
    return sendSuccess(c, updated, { message: SUCCESS_MESSAGES.INVENTORY_ADJUSTED });
  });

  app.post("/inventory/:variantId/set", async (c) => {
    const body = z
      .object({
        quantity: z.number().int().min(0),
        reason: z.string().optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) throw new ValidationError("Invalid quantity.", body.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const storeId = storeIdFromAuth(c);
    const variantId = c.req.param("variantId");
    const existing = await db.query.inventory.findFirst({
      where: and(eq(inventory.storeId, storeId), eq(inventory.variantId, variantId)),
    });
    if (!existing) throw new NotFoundError("Inventory not found.");
    const delta = body.data.quantity - existing.availableQuantity;
    const [updated] = await db
      .update(inventory)
      .set({ availableQuantity: body.data.quantity, updatedAt: new Date() })
      .where(eq(inventory.id, existing.id))
      .returning();
    await db.insert(inventoryMovements).values({
      storeId,
      variantId,
      type: "ADJUSTMENT",
      quantity: delta,
      reference: body.data.reason ?? "set-quantity",
    });
    const actor = actorFromAuth(c.get("auth"));
    await writeAuditLog(db, {
      storeId,
      actorUserId: actor.actorUserId,
      action: AUDIT_ACTIONS.INVENTORY_ADJUST,
      resourceType: "inventory",
      resourceId: variantId,
      metadata: {
        delta,
        quantity: body.data.quantity,
        reason: body.data.reason ?? "set-quantity",
      },
    });
    return sendSuccess(c, updated, { message: SUCCESS_MESSAGES.INVENTORY_ADJUSTED });
  });

  // Orders
  app.get("/orders", async (c) => {
    const parsed = paginationQuerySchema
      .extend({
        status: z
          .enum([
            "PENDING",
            "CONFIRMED",
            "PROCESSING",
            "SHIPPED",
            "DELIVERED",
            "CANCELLED",
            "REFUNDED",
          ])
          .optional(),
        q: z.string().trim().min(1).max(200).optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .safeParse(c.req.query());
    if (!parsed.success) throw new ValidationError("Invalid query.", parsed.error.flatten());
    const { page, pageSize, status, q, from, to } = parsed.data;
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const storeId = storeIdFromAuth(c);
    const clauses: SQL[] = [eq(orders.storeId, storeId)];
    if (status) clauses.push(eq(orders.status, status));
    if (q) {
      const pattern = `%${q}%`;
      clauses.push(
        sql`(${ilike(orders.orderNumber, pattern)} or ${ilike(orders.email, pattern)} or ${ilike(orders.shippingName, pattern)})`,
      );
    }
    if (from) {
      const fromDate = new Date(from);
      if (!Number.isNaN(fromDate.getTime())) {
        clauses.push(sql`${orders.createdAt} >= ${fromDate}`);
      }
    }
    if (to) {
      const toDate = new Date(to);
      if (!Number.isNaN(toDate.getTime())) {
        clauses.push(sql`${orders.createdAt} <= ${toDate}`);
      }
    }
    const where = and(...clauses);
    const [items, totalRow] = await Promise.all([
      db.query.orders.findMany({
        where,
        orderBy: [desc(orders.createdAt)],
        limit: pageSize,
        offset: paginationOffset(page, pageSize),
      }),
      db.select({ total: count() }).from(orders).where(where),
    ]);
    return sendSuccess(c, items, {
      message: SUCCESS_MESSAGES.ORDERS_RETRIEVED,
      pagination: buildPaginationMeta(page, pageSize, Number(totalRow[0]?.total ?? 0)),
    });
  });

  app.get("/orders/:orderId", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, c.req.param("orderId")), eq(orders.storeId, storeIdFromAuth(c))),
      with: { items: true, returns: { orderBy: [desc(orderReturns.createdAt)] } },
    });
    if (!order) throw new NotFoundError("Order not found.");
    return sendSuccess(c, order, { message: SUCCESS_MESSAGES.ORDER_RETRIEVED });
  });

  app.patch("/orders/:orderId", async (c) => {
    const body = z
      .object({
        status: z
          .enum([
            "PENDING",
            "CONFIRMED",
            "PROCESSING",
            "SHIPPED",
            "DELIVERED",
            "CANCELLED",
            "REFUNDED",
          ])
          .optional(),
        adminNote: z.string().trim().max(2000).nullable().optional(),
      })
      .refine((v) => v.status !== undefined || v.adminNote !== undefined, {
        message: "At least one field is required.",
      })
      .safeParse(await c.req.json());
    if (!body.success) throw new ValidationError("Invalid order update.", body.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const sid = storeIdFromAuth(c);
    const orderId = c.req.param("orderId");
    const existing = await db.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.storeId, sid)),
      with: { items: true },
    });
    if (!existing) throw new NotFoundError("Order not found.");

    if (body.data.adminNote !== undefined && body.data.status === undefined) {
      const [updated] = await db
        .update(orders)
        .set({ adminNote: body.data.adminNote, updatedAt: new Date() })
        .where(and(eq(orders.id, orderId), eq(orders.storeId, sid)))
        .returning();
      if (!updated) throw new NotFoundError("Order not found.");
      return sendSuccess(c, updated, { message: SUCCESS_MESSAGES.ORDER_UPDATED });
    }

    const nextStatus = body.data.status!;
    if (existing.status === nextStatus && body.data.adminNote === undefined) {
      return sendSuccess(c, existing, { message: SUCCESS_MESSAGES.ORDER_STATUS_CHANGED });
    }

    if (STOCK_RETURN_STATUSES.has(existing.status) && !STOCK_RETURN_STATUSES.has(nextStatus)) {
      throw new InvalidStateError("Cannot reopen a cancelled or returned order.");
    }

    const shouldRestoreStock =
      STOCK_RETURN_STATUSES.has(nextStatus) && STOCK_RESTORABLE_STATUSES.has(existing.status);

    const order = await db.transaction(async (tx) => {
      if (shouldRestoreStock) {
        await restoreOrderStock(tx as typeof db, sid, existing.id, existing.items);
        await tx
          .update(orderReturns)
          .set({
            status: "APPROVED",
            decidedAt: new Date(),
            decisionNote: "Approved via merchant restock",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(orderReturns.storeId, sid),
              eq(orderReturns.orderId, orderId),
              eq(orderReturns.status, "REQUESTED"),
            ),
          );
      }

      const [updated] = await tx
        .update(orders)
        .set({
          status: nextStatus,
          ...(body.data.adminNote !== undefined ? { adminNote: body.data.adminNote } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(orders.id, orderId), eq(orders.storeId, sid)))
        .returning();
      return updated;
    });

    if (!order) throw new NotFoundError("Order not found.");
    const actor = actorFromAuth(c.get("auth"));
    await writeAuditLog(db, {
      storeId: sid,
      actorUserId: actor.actorUserId,
      action: AUDIT_ACTIONS.ORDER_STATUS_CHANGE,
      resourceType: "order",
      resourceId: orderId,
      metadata: {
        from: existing.status,
        to: nextStatus,
        stockRestored: shouldRestoreStock,
      },
    });
    return sendSuccess(c, order, { message: SUCCESS_MESSAGES.ORDER_STATUS_CHANGED });
  });

  app.post("/orders/:orderId/fulfillment", async (c) => {
    const body = z
      .object({
        trackingNumber: z.string().trim().min(1).max(200).optional(),
        carrier: z.string().trim().min(1).max(200).optional(),
        status: z.enum(["PROCESSING", "SHIPPED", "DELIVERED"]).optional(),
      })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) throw new ValidationError("Invalid fulfillment.", body.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const sid = storeIdFromAuth(c);
    const existing = await db.query.orders.findFirst({
      where: and(eq(orders.id, c.req.param("orderId")), eq(orders.storeId, sid)),
    });
    if (!existing) throw new NotFoundError("Order not found.");
    if (STOCK_RETURN_STATUSES.has(existing.status)) {
      throw new InvalidStateError("Cannot fulfill a cancelled or refunded order.");
    }
    const [order] = await db
      .update(orders)
      .set({
        ...(body.data.trackingNumber !== undefined
          ? { trackingNumber: body.data.trackingNumber }
          : {}),
        ...(body.data.carrier !== undefined ? { carrier: body.data.carrier } : {}),
        status: body.data.status ?? "SHIPPED",
        updatedAt: new Date(),
      })
      .where(and(eq(orders.id, c.req.param("orderId")), eq(orders.storeId, sid)))
      .returning();
    if (!order) throw new NotFoundError("Order not found.");
    const actor = actorFromAuth(c.get("auth"));
    await writeAuditLog(db, {
      storeId: sid,
      actorUserId: actor.actorUserId,
      action: AUDIT_ACTIONS.ORDER_FULFILL,
      resourceType: "order",
      resourceId: order.id,
      metadata: {
        status: order.status,
        trackingNumber: order.trackingNumber,
        carrier: order.carrier,
      },
    });
    return sendSuccess(c, order, { message: SUCCESS_MESSAGES.FULFILLMENT_CREATED });
  });

  // Returns (restock only — no payment refund)
  app.get("/returns", async (c) => {
    const parsed = paginationQuerySchema
      .extend({
        status: z.enum(["REQUESTED", "APPROVED", "REJECTED"]).optional(),
      })
      .safeParse(c.req.query());
    if (!parsed.success) throw new ValidationError("Invalid query.", parsed.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const sid = storeIdFromAuth(c);
    const { page, pageSize, status } = parsed.data;
    const clauses: SQL[] = [eq(orderReturns.storeId, sid)];
    if (status) clauses.push(eq(orderReturns.status, status));
    const where = and(...clauses);
    const [{ value: total } = { value: 0 }] = await db
      .select({ value: count() })
      .from(orderReturns)
      .where(where);
    const items = await db.query.orderReturns.findMany({
      where,
      orderBy: [desc(orderReturns.createdAt)],
      limit: pageSize,
      offset: paginationOffset(page, pageSize),
      with: {
        order: {
          columns: {
            id: true,
            orderNumber: true,
            status: true,
            grandTotalPaise: true,
            createdAt: true,
          },
        },
        customer: {
          columns: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
    return sendSuccess(c, items, {
      message: SUCCESS_MESSAGES.RETURNS_RETRIEVED,
      pagination: buildPaginationMeta(page, pageSize, Number(total)),
    });
  });

  app.get("/returns/:returnId", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const sid = storeIdFromAuth(c);
    const item = await db.query.orderReturns.findFirst({
      where: and(eq(orderReturns.id, c.req.param("returnId")), eq(orderReturns.storeId, sid)),
      with: {
        order: { with: { items: true } },
        customer: {
          columns: { id: true, email: true, name: true, phone: true },
        },
      },
    });
    if (!item) throw new NotFoundError("Return not found.");
    return sendSuccess(c, item, { message: SUCCESS_MESSAGES.RETURN_RETRIEVED });
  });

  app.post("/returns/:returnId/approve", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const sid = storeIdFromAuth(c);
    const returnId = c.req.param("returnId");
    const existingReturn = await db.query.orderReturns.findFirst({
      where: and(eq(orderReturns.id, returnId), eq(orderReturns.storeId, sid)),
    });
    if (!existingReturn) throw new NotFoundError("Return not found.");
    assertReturnIsRequested(existingReturn.status);

    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, existingReturn.orderId), eq(orders.storeId, sid)),
      with: { items: true },
    });
    if (!order) throw new NotFoundError("Order not found.");
    assertOrderCanRequestReturn(order.status);

    const decidedAt = new Date();
    const updated = await db.transaction(async (tx) => {
      await restoreOrderStock(tx as typeof db, sid, order.id, order.items);
      const [ret] = await tx
        .update(orderReturns)
        .set({
          status: "APPROVED",
          decidedAt,
          updatedAt: decidedAt,
        })
        .where(and(eq(orderReturns.id, returnId), eq(orderReturns.storeId, sid)))
        .returning();
      await tx
        .update(orders)
        .set({ status: "REFUNDED", updatedAt: decidedAt })
        .where(and(eq(orders.id, order.id), eq(orders.storeId, sid)));
      return ret;
    });

    const actor = actorFromAuth(c.get("auth"));
    await writeAuditLog(db, {
      storeId: sid,
      actorUserId: actor.actorUserId,
      action: AUDIT_ACTIONS.ORDER_RETURN_APPROVE,
      resourceType: "order_return",
      resourceId: returnId,
      metadata: { orderId: order.id, stockRestored: true },
    });

    return sendSuccess(c, updated, { message: SUCCESS_MESSAGES.RETURN_APPROVED });
  });

  app.post("/returns/:returnId/reject", async (c) => {
    const body = z
      .object({
        reason: z.string().trim().min(1).max(1000).optional(),
      })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) throw new ValidationError("Invalid rejection.", body.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const sid = storeIdFromAuth(c);
    const returnId = c.req.param("returnId");
    const existingReturn = await db.query.orderReturns.findFirst({
      where: and(eq(orderReturns.id, returnId), eq(orderReturns.storeId, sid)),
    });
    if (!existingReturn) throw new NotFoundError("Return not found.");
    assertReturnIsRequested(existingReturn.status);

    const decidedAt = new Date();
    const [updated] = await db
      .update(orderReturns)
      .set({
        status: "REJECTED",
        decisionNote: body.data.reason ?? null,
        decidedAt,
        updatedAt: decidedAt,
      })
      .where(and(eq(orderReturns.id, returnId), eq(orderReturns.storeId, sid)))
      .returning();

    const actor = actorFromAuth(c.get("auth"));
    await writeAuditLog(db, {
      storeId: sid,
      actorUserId: actor.actorUserId,
      action: AUDIT_ACTIONS.ORDER_RETURN_REJECT,
      resourceType: "order_return",
      resourceId: returnId,
      metadata: { orderId: existingReturn.orderId },
    });

    return sendSuccess(c, updated, { message: SUCCESS_MESSAGES.RETURN_REJECTED });
  });

  // Customers
  app.get("/customers", async (c) => {
    const parsed = paginationQuerySchema
      .extend({ q: z.string().trim().min(1).max(200).optional() })
      .safeParse(c.req.query());
    if (!parsed.success) throw new ValidationError("Invalid query.", parsed.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const sid = storeIdFromAuth(c);
    const { page, pageSize, q } = parsed.data;
    const clauses: SQL[] = [eq(customers.storeId, sid)];
    if (q) {
      const pattern = `%${q}%`;
      clauses.push(
        sql`(${ilike(customers.name, pattern)} or ${ilike(customers.email, pattern)} or ${ilike(customers.phone, pattern)})`,
      );
    }
    const where = and(...clauses);
    const [{ value: total } = { value: 0 }] = await db
      .select({ value: count() })
      .from(customers)
      .where(where);
    const items = await db.query.customers.findMany({
      where,
      orderBy: [desc(customers.createdAt)],
      limit: pageSize,
      offset: paginationOffset(page, pageSize),
      columns: {
        id: true,
        email: true,
        name: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
        storeId: true,
      },
    });
    return sendSuccess(c, items, {
      message: SUCCESS_MESSAGES.CUSTOMERS_RETRIEVED,
      pagination: buildPaginationMeta(page, pageSize, Number(total)),
    });
  });

  app.get("/customers/:customerId", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const sid = storeIdFromAuth(c);
    const customer = await db.query.customers.findFirst({
      where: and(eq(customers.id, c.req.param("customerId")), eq(customers.storeId, sid)),
      columns: {
        id: true,
        email: true,
        name: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
        storeId: true,
      },
      with: {
        addresses: {
          orderBy: [desc(customerAddresses.createdAt)],
        },
        orders: {
          orderBy: [desc(orders.createdAt)],
          limit: 50,
        },
      },
    });
    if (!customer) throw new NotFoundError("Customer not found.");
    return sendSuccess(c, customer, { message: SUCCESS_MESSAGES.CUSTOMER_DETAILS_RETRIEVED });
  });

  // Discounts
  const discountRuleFieldsSchema = {
    startsAt: z.union([z.string().min(1), z.null()]).optional(),
    endsAt: z.union([z.string().min(1), z.null()]).optional(),
    minOrderPaise: z.number().int().nonnegative().nullable().optional(),
    usageLimit: z.number().int().positive().nullable().optional(),
  };

  function parseDiscountRuleDates(input: {
    startsAt?: string | null;
    endsAt?: string | null;
  }): { startsAt?: Date | null; endsAt?: Date | null } {
    const out: { startsAt?: Date | null; endsAt?: Date | null } = {};
    if (input.startsAt !== undefined) {
      if (input.startsAt === null) {
        out.startsAt = null;
      } else {
        const d = new Date(input.startsAt);
        if (Number.isNaN(d.getTime())) throw new ValidationError("Invalid discount start date.");
        out.startsAt = d;
      }
    }
    if (input.endsAt !== undefined) {
      if (input.endsAt === null) {
        out.endsAt = null;
      } else {
        const d = new Date(input.endsAt);
        if (Number.isNaN(d.getTime())) throw new ValidationError("Invalid discount end date.");
        out.endsAt = d;
      }
    }
    if (
      out.startsAt instanceof Date &&
      out.endsAt instanceof Date &&
      out.startsAt >= out.endsAt
    ) {
      throw new ValidationError("Discount start must be before end.");
    }
    return out;
  }

  app.get("/discounts", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const items = await db.query.discounts.findMany({
      where: eq(discounts.storeId, storeIdFromAuth(c)),
      orderBy: [desc(discounts.createdAt)],
    });
    return sendSuccess(c, items, { message: SUCCESS_MESSAGES.DISCOUNTS_RETRIEVED });
  });

  app.post("/discounts", async (c) => {
    const body = z
      .object({
        code: z.string().min(1),
        type: z.enum(["PERCENTAGE", "FIXED_PAISE"]),
        value: z.number().int().nonnegative(),
        status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
        ...discountRuleFieldsSchema,
      })
      .safeParse(await c.req.json());
    if (!body.success) throw new ValidationError("Invalid discount.", body.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const dates = parseDiscountRuleDates(body.data);
    const [item] = await db
      .insert(discounts)
      .values({
        storeId: storeIdFromAuth(c),
        code: normalizeDiscountCode(body.data.code),
        type: body.data.type,
        value: body.data.value,
        status: body.data.status,
        startsAt: dates.startsAt,
        endsAt: dates.endsAt,
        minOrderPaise: body.data.minOrderPaise,
        usageLimit: body.data.usageLimit,
      })
      .returning();
    return sendSuccess(c, item, {
      message: SUCCESS_MESSAGES.DISCOUNT_CREATED,
      status: HTTP_STATUS.CREATED,
    });
  });

  app.patch("/discounts/:discountId", async (c) => {
    const body = z
      .object({
        code: z.string().min(1).optional(),
        type: z.enum(["PERCENTAGE", "FIXED_PAISE"]).optional(),
        value: z.number().int().nonnegative().optional(),
        status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
        ...discountRuleFieldsSchema,
      })
      .safeParse(await c.req.json());
    if (!body.success) throw new ValidationError("Invalid discount.", body.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const dates = parseDiscountRuleDates(body.data);
    const [item] = await db
      .update(discounts)
      .set({
        ...(body.data.code !== undefined ? { code: normalizeDiscountCode(body.data.code) } : {}),
        ...(body.data.type !== undefined ? { type: body.data.type } : {}),
        ...(body.data.value !== undefined ? { value: body.data.value } : {}),
        ...(body.data.status !== undefined ? { status: body.data.status } : {}),
        ...(dates.startsAt !== undefined ? { startsAt: dates.startsAt } : {}),
        ...(dates.endsAt !== undefined ? { endsAt: dates.endsAt } : {}),
        ...(body.data.minOrderPaise !== undefined
          ? { minOrderPaise: body.data.minOrderPaise }
          : {}),
        ...(body.data.usageLimit !== undefined ? { usageLimit: body.data.usageLimit } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(eq(discounts.id, c.req.param("discountId")), eq(discounts.storeId, storeIdFromAuth(c))),
      )
      .returning();
    if (!item) throw new NotFoundError("Discount not found.");
    return sendSuccess(c, item, { message: SUCCESS_MESSAGES.DISCOUNT_UPDATED });
  });

  app.delete("/discounts/:discountId", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const deleted = await db
      .delete(discounts)
      .where(
        and(eq(discounts.id, c.req.param("discountId")), eq(discounts.storeId, storeIdFromAuth(c))),
      )
      .returning({ id: discounts.id });
    if (!deleted.length) throw new NotFoundError("Discount not found.");
    return sendSuccess(c, { deleted: true }, { message: SUCCESS_MESSAGES.DISCOUNT_DELETED });
  });

  // Settings
  app.get("/settings", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const storeId = storeIdFromAuth(c);
    const store = await db.query.stores.findFirst({ where: eq(stores.id, storeId) });
    if (!store) throw new StoreNotFoundError();
    const items = await db.query.storeSettings.findMany({
      where: eq(storeSettings.storeId, storeId),
    });
    return sendSuccess(c, toAdminStoreSettingsDto(store, items), {
      message: SUCCESS_MESSAGES.SETTINGS_RETRIEVED,
    });
  });

  app.patch("/settings", async (c) => {
    const parsed = updateAdminSettingsSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      throw new ValidationError("Invalid settings payload.", parsed.error.flatten());
    }
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const storeId = storeIdFromAuth(c);

    if (parsed.data.name !== undefined) {
      await new StoreService(db).update(storeId, { name: parsed.data.name });
    }

    const settingUpdates: { key: string; value: unknown }[] = [];
    if (parsed.data.domain !== undefined) {
      settingUpdates.push({ key: "domain", value: parsed.data.domain ?? "" });
    }
    if (parsed.data.contactEmail !== undefined) {
      settingUpdates.push({ key: "contactEmail", value: parsed.data.contactEmail ?? "" });
    }
    if (parsed.data.currency !== undefined) {
      settingUpdates.push({ key: "currency", value: parsed.data.currency });
    }
    if (parsed.data.timezone !== undefined) {
      settingUpdates.push({ key: "timezone", value: parsed.data.timezone });
    }
    if (parsed.data.shipping !== undefined) {
      settingUpdates.push({
        key: "shipping",
        value: {
          mode: parsed.data.shipping.mode,
          flatPaise: parsed.data.shipping.flatPaise,
          freeOverPaise: parsed.data.shipping.freeOverPaise ?? null,
        },
      });
    }
    if (parsed.data.tax !== undefined) {
      settingUpdates.push({
        key: "tax",
        value: {
          gstPercent: parsed.data.tax.gstPercent,
          gstin: parsed.data.tax.gstin?.trim() ? parsed.data.tax.gstin.trim() : null,
        },
      });
    }

    for (const { key, value } of settingUpdates) {
      const existing = await db.query.storeSettings.findFirst({
        where: and(eq(storeSettings.storeId, storeId), eq(storeSettings.key, key)),
      });
      if (existing) {
        await db
          .update(storeSettings)
          .set({ value, updatedAt: new Date() })
          .where(eq(storeSettings.id, existing.id));
      } else {
        await db.insert(storeSettings).values({ storeId, key, value });
      }
    }

    const store = await db.query.stores.findFirst({ where: eq(stores.id, storeId) });
    if (!store) throw new StoreNotFoundError();
    const items = await db.query.storeSettings.findMany({
      where: eq(storeSettings.storeId, storeId),
    });
    return sendSuccess(c, toAdminStoreSettingsDto(store, items), {
      message: SUCCESS_MESSAGES.SETTINGS_SAVED,
    });
  });

  // Sales report
  app.get("/reports/sales", async (c) => {
    const parsed = paginationQuerySchema
      .extend({
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .safeParse(c.req.query());
    if (!parsed.success) throw new ValidationError("Invalid query.", parsed.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const range = parseSalesReportRange(parsed.data.from, parsed.data.to);
    const report = await loadSalesReport(
      db,
      storeIdFromAuth(c),
      range,
      parsed.data.page,
      parsed.data.pageSize,
    );
    return sendSuccess(c, report, {
      message: SUCCESS_MESSAGES.SALES_REPORT_RETRIEVED,
      pagination: report.pagination,
    });
  });

  app.get("/reports/sales/export", async (c) => {
    const parsed = z
      .object({
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .safeParse(c.req.query());
    if (!parsed.success) throw new ValidationError("Invalid query.", parsed.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const range = parseSalesReportRange(parsed.data.from, parsed.data.to);
    const rows = await loadSalesReportExportRows(db, storeIdFromAuth(c), range);
    const csv = buildSalesCsv(rows);
    const filename = `sales-${range.from.toISOString().slice(0, 10)}_${range.to.toISOString().slice(0, 10)}.csv`;
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  });

  // Dashboard counts
  app.get("/dashboard", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const storeId = storeIdFromAuth(c);
    const [
      orderCount,
      inventoryCount,
      productCount,
      categoryCount,
      customerCount,
      salesRow,
      lowStockRow,
      pendingOrdersRow,
      openReturnsRow,
    ] = await Promise.all([
      db.select({ total: count() }).from(orders).where(eq(orders.storeId, storeId)),
      db.select({ total: count() }).from(inventory).where(eq(inventory.storeId, storeId)),
      db.select({ total: count() }).from(products).where(eq(products.storeId, storeId)),
      db.select({ total: count() }).from(categories).where(eq(categories.storeId, storeId)),
      db.select({ total: count() }).from(customers).where(eq(customers.storeId, storeId)),
      db
        .select({ total: sql<number>`coalesce(sum(${orders.grandTotalPaise}), 0)` })
        .from(orders)
        .where(
          and(
            eq(orders.storeId, storeId),
            sql`${orders.status} not in ('CANCELLED', 'REFUNDED')`,
          ),
        ),
      db
        .select({ total: count() })
        .from(inventory)
        .where(and(eq(inventory.storeId, storeId), sql`${inventory.availableQuantity} <= 5`)),
      db
        .select({ total: count() })
        .from(orders)
        .where(and(eq(orders.storeId, storeId), eq(orders.status, "PENDING"))),
      db
        .select({ total: count() })
        .from(orderReturns)
        .where(and(eq(orderReturns.storeId, storeId), eq(orderReturns.status, "REQUESTED"))),
    ]);
    return sendSuccess(
      c,
      {
        products: Number(productCount[0]?.total ?? 0),
        orders: Number(orderCount[0]?.total ?? 0),
        inventoryItems: Number(inventoryCount[0]?.total ?? 0),
        categories: Number(categoryCount[0]?.total ?? 0),
        customers: Number(customerCount[0]?.total ?? 0),
        salesPaise: Number(salesRow[0]?.total ?? 0),
        lowStockCount: Number(lowStockRow[0]?.total ?? 0),
        pendingOrdersCount: Number(pendingOrdersRow[0]?.total ?? 0),
        openReturnsCount: Number(openReturnsRow[0]?.total ?? 0),
      },
      { message: SUCCESS_MESSAGES.METRICS_RETRIEVED },
    );
  });

  // API keys (store-scoped)
  app.get("/keys", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const keys = await new StoreService(db).listKeys(storeIdFromAuth(c));
    return sendSuccess(c, keys, { message: SUCCESS_MESSAGES.API_KEYS_RETRIEVED });
  });

  app.post("/keys", async (c) => {
    const body = z.object({ type: z.enum(["PUBLISHABLE", "SECRET"]) }).safeParse(await c.req.json());
    if (!body.success) throw new ValidationError("Invalid key payload.", body.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const storeId = storeIdFromAuth(c);
    const key = await new StoreService(db).createKey(storeId, body.data.type);
    const actor = actorFromAuth(c.get("auth"));
    await writeAuditLog(db, {
      storeId,
      actorUserId: actor.actorUserId,
      action: AUDIT_ACTIONS.API_KEY_CREATE,
      resourceType: "api_key",
      resourceId: key.id,
      metadata: { type: key.type, keyPrefix: key.keyPrefix },
    });
    return sendSuccess(c, key, {
      message: SUCCESS_MESSAGES.API_KEY_GENERATED,
      status: HTTP_STATUS.CREATED,
    });
  });

  app.delete("/keys/:keyId", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const storeId = storeIdFromAuth(c);
    const keyId = c.req.param("keyId");
    const result = await new StoreService(db).deleteKey(storeId, keyId);
    const actor = actorFromAuth(c.get("auth"));
    await writeAuditLog(db, {
      storeId,
      actorUserId: actor.actorUserId,
      action: AUDIT_ACTIONS.API_KEY_REVOKE,
      resourceType: "api_key",
      resourceId: keyId,
    });
    return sendSuccess(c, result, { message: SUCCESS_MESSAGES.API_KEY_DELETED });
  });

  // Media library
  app.get("/media", async (c) => {
    const parsed = paginationQuerySchema.safeParse(c.req.query());
    if (!parsed.success) throw new ValidationError("Invalid query.", parsed.error.flatten());
    const { page, pageSize } = parsed.data;
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const storeId = storeIdFromAuth(c);
    const where = eq(productImages.storeId, storeId);
    const [items, totalRow] = await Promise.all([
      db.query.productImages.findMany({
        where,
        orderBy: [desc(productImages.createdAt)],
        limit: pageSize,
        offset: paginationOffset(page, pageSize),
      }),
      db.select({ total: count() }).from(productImages).where(where),
    ]);
    return sendSuccess(c, items, {
      message: SUCCESS_MESSAGES.MEDIA_RETRIEVED,
      pagination: buildPaginationMeta(page, pageSize, Number(totalRow[0]?.total ?? 0)),
    });
  });

  // Media (R2)
  app.get("/products/:productId/media", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const { MediaService } = await import("@/modules/media/media.service");
    const images = await new MediaService(db).listByProduct(
      storeIdFromAuth(c),
      c.req.param("productId"),
    );
    return sendSuccess(c, images, { message: SUCCESS_MESSAGES.MEDIA_RETRIEVED });
  });

  app.post("/media/upload", async (c) => {
    const storeId = storeIdFromAuth(c);
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
    await new ProductService(db).getForStore(storeId, productId);

    const {
      buildProductMediaKey,
      putObject,
      toR2Url,
    } = await import("@/infrastructure/r2/product-media");
    const storageKey = buildProductMediaKey({
      storeId,
      productId,
      filename: file.name || "upload.bin",
    });
    const contentType = file.type || "application/octet-stream";
    await putObject(bucket, storageKey, await file.arrayBuffer(), contentType);

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

  app.get("/media/:mediaId", async (c) => {
    const storeId = storeIdFromAuth(c);
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const { MediaService } = await import("@/modules/media/media.service");
    const media = await new MediaService(db).getById(storeId, c.req.param("mediaId"));
    const bucket = c.env.PRODUCT_MEDIA;
    if (!bucket) throw new NotFoundError("Media storage is not configured.");
    const { getObject } = await import("@/infrastructure/r2/product-media");
    const object = await getObject(bucket, media.storageKey);
    if (!object?.body) throw new NotFoundError("Media object not found.");
    return new Response(object.body, {
      headers: {
        "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
        "Cache-Control": "private, max-age=60",
      },
    });
  });

  app.post("/media/:mediaId/thumbnail", async (c) => {
    const storeId = storeIdFromAuth(c);
    const body = z
      .object({ isThumbnail: z.boolean().optional().default(true) })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) throw new ValidationError("Invalid body.", body.error.flatten());

    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const { MediaService } = await import("@/modules/media/media.service");
    const media = await new MediaService(db).setThumbnail(
      storeId,
      c.req.param("mediaId"),
      body.data.isThumbnail,
    );
    return sendSuccess(c, media, { message: SUCCESS_MESSAGES.MEDIA_THUMBNAIL_UPDATED });
  });

  app.patch("/media/:mediaId", async (c) => {
    const storeId = storeIdFromAuth(c);
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
      await service.swapSortOrder(storeId, c.req.param("mediaId"), body.data.swapWithMediaId);
      const media = await service.getById(storeId, c.req.param("mediaId"));
      return sendSuccess(c, media, { message: SUCCESS_MESSAGES.MEDIA_UPDATED });
    }

    const media = await service.update(storeId, c.req.param("mediaId"), {
      altText: body.data.altText,
      sortOrder: body.data.sortOrder,
    });
    return sendSuccess(c, media, { message: SUCCESS_MESSAGES.MEDIA_UPDATED });
  });

  app.delete("/media/:mediaId", async (c) => {
    const storeId = storeIdFromAuth(c);
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const { MediaService } = await import("@/modules/media/media.service");
    const media = await new MediaService(db).remove(storeId, c.req.param("mediaId"));
    if (c.env.PRODUCT_MEDIA && media.storageKey) {
      const { deleteObject } = await import("@/infrastructure/r2/product-media");
      await deleteObject(c.env.PRODUCT_MEDIA, media.storageKey);
    }
    return sendSuccess(c, { deleted: true }, { message: SUCCESS_MESSAGES.MEDIA_DELETED });
  });

  return app;
}
