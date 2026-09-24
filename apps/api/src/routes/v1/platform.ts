import { Hono } from "hono";
import { z } from "zod";
import { requirePlatformAdmin } from "@/middleware/require-admin";
import { scheduleDbClose, useRequestDb } from "@/middleware/database";
import { StoreService } from "@/modules/store/store.service";
import { ProductService } from "@/modules/product/product.service";
import { listProductsQuerySchema } from "@/modules/product/product.schemas";
import {
  registerStoreProductRoutes,
  resolveStoreIdFromPath,
} from "@/modules/product/product.store.routes";
import { AUDIT_ACTIONS, actorFromAuth, writeAuditLog } from "@/modules/audit";
import {
  buildSalesCsv,
  loadSalesReport,
  loadSalesReportExportRows,
  parseSalesReportRange,
} from "@/modules/reports";
import { platformSettings } from "@/db/schema/platform-settings";
import { orders } from "@/db/schema/orders";
import { customers } from "@/db/schema/customers";
import { auditLogs } from "@/db/schema/audit-logs";
import { products } from "@/db/schema/products";
import { stores } from "@/db/schema/stores";
import { users } from "@/db/schema/users";
import { and, count, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import { sendSuccess } from "@/shared/response/success";
import { NotFoundError, ValidationError } from "@/shared/errors/app-error";
import type { AppEnv } from "@/shared/types/hono";
import { HTTP_STATUS } from "@/shared/constants/http";
import { SUCCESS_MESSAGES } from "@/shared/constants/success-messages";
import { paginationQuerySchema } from "@/shared/pagination/pagination.schema";
import { buildPaginationMeta, paginationOffset } from "@/shared/pagination/pagination";
import { registerPlatformGlobalCatalogRoutes } from "@/modules/global-catalog/global-catalog.platform.routes";

const createStoreSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

const updateStoreSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

const createAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const updateAdminSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  isActive: z.boolean().optional(),
});

const createKeySchema = z.object({
  type: z.enum(["PUBLISHABLE", "SECRET"]),
});

const updatePlatformSettingsSchema = z.object({
  platformName: z.string().trim().min(1).max(200).optional(),
  supportEmail: z
    .string()
    .trim()
    .email()
    .nullable()
    .or(z.literal(""))
    .optional(),
});

function textSetting(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toPlatformSettingsDto(items: { key: string; value: unknown }[]) {
  const map = Object.fromEntries(items.map((item) => [item.key, item.value]));
  return {
    platformName: textSetting(map.platformName) ?? "",
    supportEmail: textSetting(map.supportEmail),
    defaultCurrency: "INR" as const,
  };
}

export function createPlatformRoutes() {
  const app = new Hono<AppEnv>();
  app.use("*", requirePlatformAdmin());

  app.get("/metrics", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const [storeCount, productCount, orderCount, adminCount, salesRow] = await Promise.all([
      db.select({ total: count() }).from(stores),
      db.select({ total: count() }).from(products),
      db.select({ total: count() }).from(orders),
      db.select({ total: count() }).from(users).where(eq(users.role, "STORE_ADMIN")),
      db
        .select({ total: sql<number>`coalesce(sum(${orders.grandTotalPaise}), 0)` })
        .from(orders)
        .where(sql`${orders.status} not in ('CANCELLED', 'REFUNDED')`),
    ]);
    const payload = {
      storeCount: Number(storeCount[0]?.total ?? 0),
      productCount: Number(productCount[0]?.total ?? 0),
      orderCount: Number(orderCount[0]?.total ?? 0),
      adminCount: Number(adminCount[0]?.total ?? 0),
      salesPaise: Number(salesRow[0]?.total ?? 0),
      // Back-compat aliases
      stores: Number(storeCount[0]?.total ?? 0),
      products: Number(productCount[0]?.total ?? 0),
      orders: Number(orderCount[0]?.total ?? 0),
      storeAdmins: Number(adminCount[0]?.total ?? 0),
    };
    return sendSuccess(c, payload, { message: SUCCESS_MESSAGES.METRICS_RETRIEVED });
  });

  app.get("/reports/sales", async (c) => {
    const parsed = paginationQuerySchema
      .extend({
        storeId: z.string().uuid(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .safeParse(c.req.query());
    if (!parsed.success) throw new ValidationError("Invalid query.", parsed.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const store = await db.query.stores.findFirst({ where: eq(stores.id, parsed.data.storeId) });
    if (!store) throw new NotFoundError("Store not found.");
    const range = parseSalesReportRange(parsed.data.from, parsed.data.to);
    const report = await loadSalesReport(
      db,
      parsed.data.storeId,
      range,
      parsed.data.page,
      parsed.data.pageSize,
    );
    return sendSuccess(
      c,
      { ...report, storeId: store.id, storeName: store.name },
      {
        message: SUCCESS_MESSAGES.SALES_REPORT_RETRIEVED,
        pagination: report.pagination,
      },
    );
  });

  app.get("/reports/sales/export", async (c) => {
    const parsed = z
      .object({
        storeId: z.string().uuid(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .safeParse(c.req.query());
    if (!parsed.success) throw new ValidationError("Invalid query.", parsed.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const store = await db.query.stores.findFirst({ where: eq(stores.id, parsed.data.storeId) });
    if (!store) throw new NotFoundError("Store not found.");
    const range = parseSalesReportRange(parsed.data.from, parsed.data.to);
    const rows = await loadSalesReportExportRows(db, parsed.data.storeId, range);
    const csv = buildSalesCsv(rows);
    const filename = `sales-${store.slug}-${range.from.toISOString().slice(0, 10)}_${range.to.toISOString().slice(0, 10)}.csv`;
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  });

  app.get("/stores", async (c) => {
    const page = Number(c.req.query("page") ?? 1);
    const pageSize = Number(c.req.query("pageSize") ?? 20);
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const result = await new StoreService(db).list(page, pageSize);
    return sendSuccess(c, result.items, {
      message: SUCCESS_MESSAGES.STORES_RETRIEVED,
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / result.pageSize) || 1,
      },
    });
  });

  app.post("/stores", async (c) => {
    const parsed = createStoreSchema.safeParse(await c.req.json());
    if (!parsed.success) throw new ValidationError("Invalid store payload.", parsed.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const created = await new StoreService(db).create(parsed.data);
    const actor = actorFromAuth(c.get("auth"));
    await writeAuditLog(db, {
      storeId: created.store.id,
      actorUserId: actor.actorUserId,
      action: AUDIT_ACTIONS.STORE_CREATE,
      resourceType: "store",
      resourceId: created.store.id,
      metadata: { slug: created.store.slug, name: created.store.name },
    });
    return sendSuccess(c, created, {
      message: SUCCESS_MESSAGES.STORE_CREATED,
      status: HTTP_STATUS.CREATED,
    });
  });

  app.get("/stores/:storeId", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const store = await new StoreService(db).get(c.req.param("storeId"));
    return sendSuccess(c, store, { message: SUCCESS_MESSAGES.STORE_RETRIEVED });
  });

  app.patch("/stores/:storeId", async (c) => {
    const parsed = updateStoreSchema.safeParse(await c.req.json());
    if (!parsed.success) throw new ValidationError("Invalid store payload.", parsed.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const storeId = c.req.param("storeId");
    const store = await new StoreService(db).update(storeId, parsed.data);
    if (parsed.data.status === "INACTIVE") {
      const actor = actorFromAuth(c.get("auth"));
      await writeAuditLog(db, {
        storeId,
        actorUserId: actor.actorUserId,
        action: AUDIT_ACTIONS.STORE_DEACTIVATE,
        resourceType: "store",
        resourceId: storeId,
        metadata: { status: store.status, via: "patch" },
      });
    } else if (parsed.data.status === "ACTIVE") {
      const actor = actorFromAuth(c.get("auth"));
      await writeAuditLog(db, {
        storeId,
        actorUserId: actor.actorUserId,
        action: AUDIT_ACTIONS.STORE_ACTIVATE,
        resourceType: "store",
        resourceId: storeId,
        metadata: { status: store.status, via: "patch" },
      });
    }
    return sendSuccess(c, store, { message: SUCCESS_MESSAGES.STORE_UPDATED });
  });

  app.delete("/stores/:storeId", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const storeId = c.req.param("storeId");
    const removed = await new StoreService(db).remove(storeId);
    const actor = actorFromAuth(c.get("auth"));
    await writeAuditLog(db, {
      storeId: null,
      actorUserId: actor.actorUserId,
      action: AUDIT_ACTIONS.STORE_DELETE,
      resourceType: "store",
      resourceId: removed.id,
      metadata: { name: removed.name, slug: removed.slug, status: removed.status },
    });
    if (c.env.PRODUCT_MEDIA && removed.storageKeys.length > 0) {
      const { deleteObject } = await import("@/infrastructure/r2/product-media");
      await Promise.allSettled(
        removed.storageKeys.map((key) => deleteObject(c.env.PRODUCT_MEDIA!, key)),
      );
    }
    return sendSuccess(
      c,
      { id: removed.id, name: removed.name, slug: removed.slug, deleted: true as const },
      { message: SUCCESS_MESSAGES.STORE_DELETED },
    );
  });

  app.get("/stores/:storeId/admins", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const admins = await new StoreService(db).listAdmins(c.req.param("storeId"));
    return sendSuccess(c, admins, { message: SUCCESS_MESSAGES.STORE_ADMINS_RETRIEVED });
  });

  app.post("/stores/:storeId/admins", async (c) => {
    const parsed = createAdminSchema.safeParse(await c.req.json());
    if (!parsed.success) throw new ValidationError("Invalid admin payload.", parsed.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const storeId = c.req.param("storeId");
    const admin = await new StoreService(db).createAdmin(storeId, parsed.data);
    const actor = actorFromAuth(c.get("auth"));
    await writeAuditLog(db, {
      storeId,
      actorUserId: actor.actorUserId,
      action: AUDIT_ACTIONS.STORE_ADMIN_CREATE,
      resourceType: "user",
      resourceId: admin.id,
      metadata: { email: admin.email },
    });
    return sendSuccess(c, admin, {
      message: SUCCESS_MESSAGES.STORE_ADMIN_CREATED,
      status: HTTP_STATUS.CREATED,
    });
  });

  app.patch("/stores/:storeId/admins/:userId", async (c) => {
    const parsed = updateAdminSchema.safeParse(await c.req.json());
    if (!parsed.success) throw new ValidationError("Invalid admin update.", parsed.error.flatten());
    if (
      parsed.data.email === undefined &&
      parsed.data.password === undefined &&
      parsed.data.isActive === undefined
    ) {
      throw new ValidationError("At least one admin field is required.");
    }
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const admin = await new StoreService(db).updateAdmin(
      c.req.param("storeId"),
      c.req.param("userId"),
      parsed.data,
    );
    return sendSuccess(c, admin, { message: SUCCESS_MESSAGES.STORE_ADMIN_UPDATED });
  });

  app.delete("/stores/:storeId/admins/:userId", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const result = await new StoreService(db).removeAdmin(
      c.req.param("storeId"),
      c.req.param("userId"),
    );
    return sendSuccess(c, result, { message: SUCCESS_MESSAGES.STORE_ADMIN_DELETED });
  });

  app.get("/stores/:storeId/keys", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const keys = await new StoreService(db).listKeys(c.req.param("storeId"));
    return sendSuccess(c, keys, { message: SUCCESS_MESSAGES.API_KEYS_RETRIEVED });
  });

  app.post("/stores/:storeId/keys", async (c) => {
    const parsed = createKeySchema.safeParse(await c.req.json());
    if (!parsed.success) throw new ValidationError("Invalid key payload.", parsed.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const storeId = c.req.param("storeId");
    const key = await new StoreService(db).createKey(storeId, parsed.data.type);
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

  app.delete("/stores/:storeId/keys/:keyId", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const storeId = c.req.param("storeId");
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

  app.get("/products", async (c) => {
    const parsed = listProductsQuerySchema.safeParse(c.req.query());
    if (!parsed.success) throw new ValidationError("Invalid query.", parsed.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const result = await new ProductService(db).listForPlatform(parsed.data);
    return sendSuccess(c, result.items, {
      message: SUCCESS_MESSAGES.PRODUCTS_RETRIEVED,
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / result.pageSize) || 1,
      },
    });
  });

  app.get("/orders", async (c) => {
    const parsed = paginationQuerySchema
      .extend({
        storeId: z.string().uuid().optional(),
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
      })
      .safeParse(c.req.query());
    if (!parsed.success) throw new ValidationError("Invalid query.", parsed.error.flatten());
    const { page, pageSize, storeId, status, q } = parsed.data;
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const clauses: SQL[] = [];
    if (storeId) clauses.push(eq(orders.storeId, storeId));
    if (status) clauses.push(eq(orders.status, status));
    if (q) {
      const pattern = `%${q}%`;
      clauses.push(
        sql`(${ilike(orders.orderNumber, pattern)} or ${ilike(orders.email, pattern)} or ${ilike(orders.shippingName, pattern)})`,
      );
    }
    const where = clauses.length ? and(...clauses) : undefined;
    const [items, totalRow] = await Promise.all([
      db.query.orders.findMany({
        where,
        orderBy: [desc(orders.createdAt)],
        limit: pageSize,
        offset: paginationOffset(page, pageSize),
      }),
      db.select({ total: count() }).from(orders).where(where),
    ]);
    const total = Number(totalRow[0]?.total ?? 0);
    return sendSuccess(c, items, {
      message: SUCCESS_MESSAGES.ORDERS_RETRIEVED,
      pagination: buildPaginationMeta(page, pageSize, total),
    });
  });

  app.get("/orders/:orderId", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, c.req.param("orderId")),
      with: { items: true },
    });
    if (!order) throw new NotFoundError("Order not found.");
    return sendSuccess(c, order, { message: SUCCESS_MESSAGES.ORDER_RETRIEVED });
  });

  app.get("/customers", async (c) => {
    const parsed = paginationQuerySchema
      .extend({
        storeId: z.string().uuid().optional(),
      })
      .safeParse(c.req.query());
    if (!parsed.success) throw new ValidationError("Invalid query.", parsed.error.flatten());
    const { page, pageSize, storeId } = parsed.data;
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const where = storeId ? eq(customers.storeId, storeId) : undefined;
    const [items, totalRow] = await Promise.all([
      db.query.customers.findMany({
        where,
        orderBy: [desc(customers.createdAt)],
        limit: pageSize,
        offset: paginationOffset(page, pageSize),
        columns: {
          id: true,
          storeId: true,
          email: true,
          name: true,
          phone: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.select({ total: count() }).from(customers).where(where),
    ]);
    return sendSuccess(c, items, {
      message: SUCCESS_MESSAGES.CUSTOMERS_RETRIEVED,
      pagination: buildPaginationMeta(page, pageSize, Number(totalRow[0]?.total ?? 0)),
    });
  });

  app.get("/customers/:customerId", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const customer = await db.query.customers.findFirst({
      where: eq(customers.id, c.req.param("customerId")),
      columns: {
        id: true,
        storeId: true,
        email: true,
        name: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
      },
      with: {
        orders: {
          orderBy: [desc(orders.createdAt)],
          limit: 50,
        },
      },
    });
    if (!customer) throw new NotFoundError("Customer not found.");
    return sendSuccess(c, customer, { message: SUCCESS_MESSAGES.CUSTOMER_DETAILS_RETRIEVED });
  });

  app.get("/audit-logs", async (c) => {
    const parsed = paginationQuerySchema
      .extend({
        storeId: z.string().uuid().optional(),
        action: z.string().trim().min(1).optional(),
      })
      .safeParse(c.req.query());
    if (!parsed.success) throw new ValidationError("Invalid query.", parsed.error.flatten());
    const { page, pageSize, storeId, action } = parsed.data;
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const clauses: SQL[] = [];
    if (storeId) clauses.push(eq(auditLogs.storeId, storeId));
    if (action) clauses.push(eq(auditLogs.action, action));
    const where = clauses.length ? and(...clauses) : undefined;
    const [items, totalRow] = await Promise.all([
      db.query.auditLogs.findMany({
        where,
        orderBy: [desc(auditLogs.createdAt)],
        limit: pageSize,
        offset: paginationOffset(page, pageSize),
      }),
      db.select({ total: count() }).from(auditLogs).where(where),
    ]);
    return sendSuccess(c, items, {
      message: SUCCESS_MESSAGES.AUDIT_LOGS_RETRIEVED,
      pagination: buildPaginationMeta(page, pageSize, Number(totalRow[0]?.total ?? 0)),
    });
  });

  app.get("/settings", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const items = await db.query.platformSettings.findMany();
    return sendSuccess(c, toPlatformSettingsDto(items), {
      message: SUCCESS_MESSAGES.SETTINGS_RETRIEVED,
    });
  });

  app.patch("/settings", async (c) => {
    const parsed = updatePlatformSettingsSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      throw new ValidationError("Invalid settings payload.", parsed.error.flatten());
    }
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);

    const updates: { key: string; value: string }[] = [];
    if (parsed.data.platformName !== undefined) {
      updates.push({ key: "platformName", value: parsed.data.platformName });
    }
    if (parsed.data.supportEmail !== undefined) {
      updates.push({ key: "supportEmail", value: parsed.data.supportEmail ?? "" });
    }

    for (const { key, value } of updates) {
      const existing = await db.query.platformSettings.findFirst({
        where: eq(platformSettings.key, key),
      });
      if (existing) {
        await db
          .update(platformSettings)
          .set({ value, updatedAt: new Date() })
          .where(eq(platformSettings.id, existing.id));
      } else {
        await db.insert(platformSettings).values({ key, value });
      }
    }
    const items = await db.query.platformSettings.findMany();
    return sendSuccess(c, toPlatformSettingsDto(items), {
      message: SUCCESS_MESSAGES.SETTINGS_SAVED,
    });
  });

  registerPlatformGlobalCatalogRoutes(app);

  registerStoreProductRoutes(app, resolveStoreIdFromPath, {
    includeCategoryList: true,
    pathPrefix: "/stores/:storeId",
  });

  return app;
}
