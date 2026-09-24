import { Hono } from "hono";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { requirePublishableKey } from "@/middleware/require-storefront";
import { requireCustomerId, resolveOptionalCustomerId } from "@/middleware/require-customer";
import { scheduleDbClose, useRequestDb } from "@/middleware/database";
import { storefrontMutationRateLimit } from "@/middleware/rate-limit";
import { ProductService } from "@/modules/product/product.service";
import {
  listStorefrontProductsQuerySchema,
} from "@/modules/product/product.schemas";
import {
  findSellableVariant,
  listSellableVariantsForProduct,
} from "@/modules/global-catalog/sellable-variant";
import { CollectionService } from "@/modules/collection/collection.service";
import {
  assertDiscountApplicable,
  computeDiscountPaise,
  findApplicableDiscountByCode,
  normalizeDiscountCode,
  tryIncrementDiscountUsage,
} from "@/modules/discount";
import { computeCheckoutTotals, notifyOrderPlaced, zeptoMailConfigFromEnv } from "@/modules/checkout";
import {
  addressBodySchema,
  applyDefaultShippingToCart,
  cartHasShippingSnapshot,
  deleteCustomerAddress,
  getCustomerAddress,
  insertCustomerAddress,
  listCustomerAddresses,
  presentCustomer,
  saveCartShippingSchema,
  shippingFieldsFromAddress,
  updateAddressBodySchema,
  updateCustomerProfile,
  updateCustomerProfileSchema,
} from "@/modules/customer";
import {
  loadStoreCommerceSettings,
  type StoreCommerceSettings,
} from "@/modules/store/commerce-settings";
import {
  assertOrderCanRequestReturn,
  findBlockingReturn,
} from "@/modules/returns";
import { stores } from "@/db/schema/stores";
import { storeSettings } from "@/db/schema/store-settings";
import { categories } from "@/db/schema/categories";
import { collections } from "@/db/schema/collections";
import { carts } from "@/db/schema/carts";
import { cartLineItems } from "@/db/schema/cart-line-items";
import { customers } from "@/db/schema/customers";
import { customerAddresses } from "@/db/schema/customer-addresses";
import { wishlistItems } from "@/db/schema/wishlist-items";
import { discounts } from "@/db/schema/discounts";
import { orderReturns } from "@/db/schema/order-returns";
import { orders } from "@/db/schema/orders";
import { orderItems } from "@/db/schema/order-items";
import { inventory } from "@/db/schema/inventory";
import { inventoryMovements } from "@/db/schema/inventory-movements";
import { hashPassword, verifyPassword } from "@/infrastructure/crypto/password";
import { signAuthToken } from "@/modules/auth/jwt";
import { IDEMPOTENCY_KEY_HEADER } from "@/shared/constants/headers";
import { sendSuccess } from "@/shared/response/success";
import {
  DuplicateResourceError,
  InsufficientStockError,
  InvalidApiKeyError,
  InvalidStateError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@/shared/errors/app-error";
import { HTTP_STATUS } from "@/shared/constants/http";
import { SUCCESS_MESSAGES } from "@/shared/constants/success-messages";
import { normalizeEmail } from "@/shared/tenant/normalize";
import type { Database } from "@/db/client";
import type { AppEnv } from "@/shared/types/hono";

function storeId(c: { get: (k: "auth") => { storeId?: string | null } | undefined }) {
  const id = c.get("auth")?.storeId;
  if (!id) throw new InvalidApiKeyError();
  return id;
}

async function loadCart(db: Database, sid: string, cartId: string) {
  const cart = await db.query.carts.findFirst({
    where: and(eq(carts.id, cartId), eq(carts.storeId, sid)),
    with: { items: true },
  });
  if (!cart) throw new NotFoundError("Cart not found.");
  return cart;
}

type LoadedCart = Awaited<ReturnType<typeof loadCart>>;

/** Attach estimated tax / shipping / grand total for storefront display. */
function presentCart(cart: LoadedCart, commerce: StoreCommerceSettings) {
  const hasItems = cart.items.length > 0;
  const totals = computeCheckoutTotals(cart.subtotalPaise, cart.discountTotalPaise, {
    applyShipping: hasItems,
    shipping: commerce.shipping,
    tax: commerce.tax,
  });
  return {
    ...cart,
    taxTotalPaise: totals.taxTotalPaise,
    shippingTotalPaise: totals.shippingTotalPaise,
    grandTotalPaise: totals.grandTotalPaise,
    gstPercent: commerce.tax.gstPercent,
  };
}

async function loadPresentedCart(db: Database, sid: string, cartId: string) {
  const [cart, commerce] = await Promise.all([
    loadCart(db, sid, cartId),
    loadStoreCommerceSettings(db, sid),
  ]);
  return presentCart(cart, commerce);
}

async function refreshCartDiscount(db: Database, sid: string, cartId: string) {
  const cart = await loadCart(db, sid, cartId);
  const subtotalPaise = cart.items.reduce((sum, i) => sum + i.unitPricePaise * i.quantity, 0);
  let discountCode = cart.discountCode;
  let discountTotalPaise = 0;

  if (discountCode) {
    const discount = await db.query.discounts.findFirst({
      where: and(
        eq(discounts.storeId, sid),
        eq(discounts.code, discountCode),
        eq(discounts.status, "ACTIVE"),
      ),
    });
    if (!discount) {
      discountCode = null;
      discountTotalPaise = 0;
    } else {
      try {
        assertDiscountApplicable(discount, subtotalPaise);
        discountTotalPaise = computeDiscountPaise(discount.type, discount.value, subtotalPaise);
      } catch {
        discountCode = null;
        discountTotalPaise = 0;
      }
    }
  }

  await db
    .update(carts)
    .set({
      subtotalPaise,
      discountCode,
      discountTotalPaise,
      updatedAt: new Date(),
    })
    .where(eq(carts.id, cart.id));

  return loadPresentedCart(db, sid, cart.id);
}

export function createStorefrontRoutes() {
  const app = new Hono<AppEnv>();
  app.use("*", requirePublishableKey());
  app.use("/carts", storefrontMutationRateLimit());
  app.use("/carts/*", storefrontMutationRateLimit());

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
    const commerce = await loadStoreCommerceSettings(db, sid);
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
        shipping: commerce.shipping,
        tax: commerce.tax,
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
    const source = product.source;
    const sellable = await listSellableVariantsForProduct(db, sid, product.id, source);
    const stocks = await db.query.inventory.findMany({
      where: and(eq(inventory.storeId, sid)),
    });
    const stockByVariant = new Map(stocks.map((s) => [s.variantId, s.availableQuantity]));

    let images: Array<{
      id: string;
      altText: string | null;
      isThumbnail?: boolean;
      sortOrder?: number;
      src: string;
    }> = [];

    if (source === "STORE") {
      const { MediaService } = await import("@/modules/media/media.service");
      const media = await new MediaService(db).listByProduct(sid, product.id);
      images = media.map((image) => ({
        ...image,
        src: `/api/v1/store/media/${image.id}`,
      }));
    } else {
      const media = await new ProductService(db).listGlobalCatalogImages(product.id);
      images = media.map((image) => ({
        id: image.id,
        altText: image.altText,
        isThumbnail: image.isThumbnail,
        sortOrder: image.sortOrder,
        src: `/api/v1/store/global-media/${image.id}`,
      }));
    }

    const thumbnail =
      images.find((img) => img.isThumbnail) ?? images[0] ?? null;

    return sendSuccess(
      c,
      {
        ...product,
        variants: sellable.map((v) => ({
          id: v.variantId,
          productId: v.productId,
          sku: v.sku,
          title: v.title,
          pricePaise: v.pricePaise,
          compareAtPricePaise: v.compareAtPricePaise,
          status: v.status,
          availableQuantity: stockByVariant.get(v.variantId) ?? 0,
          source: v.source,
        })),
        images,
        thumbnail: thumbnail
          ? {
              id: thumbnail.id,
              altText: thumbnail.altText,
              src: thumbnail.src,
            }
          : null,
      },
      { message: SUCCESS_MESSAGES.PRODUCT_RETRIEVED },
    );
  });

  app.get("/media/:mediaId", async (c) => {
    const sid = storeId(c);
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const { MediaService } = await import("@/modules/media/media.service");
    const media = await new MediaService(db).getById(sid, c.req.param("mediaId"));
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
        "Cache-Control": "public, max-age=3600",
      },
    });
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
        "Cache-Control": "public, max-age=3600",
      },
    });
  });

  app.get("/categories", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const items = await db.query.categories.findMany({
      where: and(eq(categories.storeId, storeId(c)), eq(categories.status, "ACTIVE")),
    });
    return sendSuccess(c, items, { message: SUCCESS_MESSAGES.CATEGORIES_RETRIEVED });
  });

  app.get("/categories/:slug", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const sid = storeId(c);
    const item = await db.query.categories.findFirst({
      where: and(
        eq(categories.storeId, sid),
        eq(categories.slug, c.req.param("slug")),
        eq(categories.status, "ACTIVE"),
      ),
    });
    if (!item) throw new NotFoundError("Category not found.");
    const catalog = await new ProductService(db).listCatalog(sid, {
      page: 1,
      pageSize: 100,
      categoryId: item.id,
    });
    const { MediaService } = await import("@/modules/media/media.service");
    const thumbnails = await new MediaService(db).thumbnailsForProducts(
      sid,
      catalog.items.map((product) => product.id),
    );
    const productsWithThumbs = catalog.items.map((product) => {
      const thumb = thumbnails.get(product.id);
      return {
        ...product,
        thumbnail: thumb
          ? {
              id: thumb.id,
              altText: thumb.altText,
              src: `/api/v1/store/media/${thumb.id}`,
            }
          : null,
      };
    });
    return sendSuccess(c, { ...item, products: productsWithThumbs }, {
      message: SUCCESS_MESSAGES.CATEGORY_RETRIEVED,
    });
  });

  app.get("/collections", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const items = await db.query.collections.findMany({
      where: and(eq(collections.storeId, storeId(c)), eq(collections.status, "ACTIVE")),
    });
    return sendSuccess(c, items, { message: SUCCESS_MESSAGES.COLLECTIONS_RETRIEVED });
  });

  app.get("/collections/:slug", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const item = await new CollectionService(db).getBySlugWithProducts(
      storeId(c),
      c.req.param("slug"),
    );
    return sendSuccess(c, item, { message: SUCCESS_MESSAGES.COLLECTION_RETRIEVED });
  });

  app.post("/carts", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const sid = storeId(c);
    const customerId = await resolveOptionalCustomerId(c, sid);
    const [cart] = await db
      .insert(carts)
      .values({
        storeId: sid,
        customerId,
        status: "ACTIVE",
        subtotalPaise: 0,
        discountTotalPaise: 0,
      })
      .returning();
    if (customerId) {
      await applyDefaultShippingToCart(db, sid, cart!.id, customerId, cart!);
    }
    return sendSuccess(c, await loadPresentedCart(db, sid, cart!.id), {
      message: SUCCESS_MESSAGES.CART_CREATED,
      status: HTTP_STATUS.CREATED,
    });
  });

  app.get("/carts/:cartId", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const cart = await loadPresentedCart(db, storeId(c), c.req.param("cartId"));
    return sendSuccess(c, cart, { message: SUCCESS_MESSAGES.CART_RETRIEVED });
  });

  app.post("/carts/:cartId/email", async (c) => {
    const body = z
      .object({ email: z.string().email() })
      .safeParse(await c.req.json());
    if (!body.success) throw new ValidationError("Invalid email.", body.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const sid = storeId(c);
    const cart = await loadCart(db, sid, c.req.param("cartId"));
    if (cart.status !== "ACTIVE") throw new ValidationError("Cart is not active.");
    await db
      .update(carts)
      .set({ email: normalizeEmail(body.data.email), updatedAt: new Date() })
      .where(eq(carts.id, cart.id));
    return sendSuccess(c, await loadPresentedCart(db, sid, cart.id), {
      message: SUCCESS_MESSAGES.CART_EMAIL_UPDATED,
    });
  });

  app.post("/carts/:cartId/customer", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const sid = storeId(c);
    const customerId = await requireCustomerId(c, sid);
    const cart = await loadCart(db, sid, c.req.param("cartId"));
    if (cart.status !== "ACTIVE") throw new ValidationError("Cart is not active.");
    if (cart.customerId && cart.customerId !== customerId) {
      throw new ValidationError("Cart already belongs to another customer.");
    }
    await db
      .update(carts)
      .set({ customerId, updatedAt: new Date() })
      .where(eq(carts.id, cart.id));
    await applyDefaultShippingToCart(db, sid, cart.id, customerId, cart);
    return sendSuccess(c, await loadPresentedCart(db, sid, cart.id), {
      message: SUCCESS_MESSAGES.CART_RETRIEVED,
    });
  });

  app.post("/carts/:cartId/items", async (c) => {
    const body = z
      .object({ variantId: z.string().uuid(), quantity: z.number().int().positive() })
      .safeParse(await c.req.json());
    if (!body.success) throw new ValidationError("Invalid cart item.", body.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const sid = storeId(c);
    await loadCart(db, sid, c.req.param("cartId"));
    const variant = await findSellableVariant(db, sid, body.data.variantId);
    if (!variant || variant.status !== "ACTIVE") throw new NotFoundError("Variant not found.");
    const existing = await db.query.cartLineItems.findFirst({
      where: and(
        eq(cartLineItems.cartId, c.req.param("cartId")),
        eq(cartLineItems.variantId, body.data.variantId),
      ),
    });
    const nextQty = (existing?.quantity ?? 0) + body.data.quantity;
    const stock = await db.query.inventory.findFirst({
      where: and(eq(inventory.storeId, sid), eq(inventory.variantId, body.data.variantId)),
    });
    if (!stock || stock.availableQuantity < nextQty) {
      throw new InsufficientStockError();
    }
    if (existing) {
      await db
        .update(cartLineItems)
        .set({
          quantity: nextQty,
          updatedAt: new Date(),
        })
        .where(eq(cartLineItems.id, existing.id));
    } else {
      await db.insert(cartLineItems).values({
        storeId: sid,
        cartId: c.req.param("cartId"),
        variantId: body.data.variantId,
        source: variant.source,
        quantity: body.data.quantity,
        unitPricePaise: variant.pricePaise,
      });
    }
    return sendSuccess(c, await refreshCartDiscount(db, sid, c.req.param("cartId")), {
      message: SUCCESS_MESSAGES.CART_ITEM_ADDED,
    });
  });

  app.patch("/carts/:cartId/items/:itemId", async (c) => {
    const body = z.object({ quantity: z.number().int().positive() }).safeParse(await c.req.json());
    if (!body.success) throw new ValidationError("Invalid quantity.", body.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const sid = storeId(c);
    const existing = await db.query.cartLineItems.findFirst({
      where: and(
        eq(cartLineItems.id, c.req.param("itemId")),
        eq(cartLineItems.cartId, c.req.param("cartId")),
        eq(cartLineItems.storeId, sid),
      ),
    });
    if (!existing) throw new NotFoundError("Cart item not found.");
    const stock = await db.query.inventory.findFirst({
      where: and(eq(inventory.storeId, sid), eq(inventory.variantId, existing.variantId)),
    });
    if (!stock || stock.availableQuantity < body.data.quantity) {
      throw new InsufficientStockError();
    }
    await db
      .update(cartLineItems)
      .set({ quantity: body.data.quantity, updatedAt: new Date() })
      .where(eq(cartLineItems.id, existing.id));
    return sendSuccess(c, await refreshCartDiscount(db, sid, c.req.param("cartId")), {
      message: SUCCESS_MESSAGES.CART_ITEM_UPDATED,
    });
  });

  app.delete("/carts/:cartId/items/:itemId", async (c) => {
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const sid = storeId(c);
    const deleted = await db
      .delete(cartLineItems)
      .where(
        and(
          eq(cartLineItems.id, c.req.param("itemId")),
          eq(cartLineItems.cartId, c.req.param("cartId")),
          eq(cartLineItems.storeId, sid),
        ),
      )
      .returning({ id: cartLineItems.id });
    if (!deleted.length) throw new NotFoundError("Cart item not found.");
    return sendSuccess(c, await refreshCartDiscount(db, sid, c.req.param("cartId")), {
      message: SUCCESS_MESSAGES.CART_ITEM_REMOVED,
    });
  });

  app.post("/carts/:cartId/discount", async (c) => {
    const body = z
      .object({
        code: z.string().min(1).nullable().optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) throw new ValidationError("Invalid discount.", body.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const sid = storeId(c);
    const cart = await loadCart(db, sid, c.req.param("cartId"));
    if (cart.status !== "ACTIVE") throw new ValidationError("Cart is not active.");

    if (body.data.code === null || body.data.code === undefined || body.data.code.trim() === "") {
      await db
        .update(carts)
        .set({ discountCode: null, discountTotalPaise: 0, updatedAt: new Date() })
        .where(eq(carts.id, cart.id));
      return sendSuccess(c, await loadPresentedCart(db, sid, cart.id), {
        message: SUCCESS_MESSAGES.DISCOUNT_REMOVED,
      });
    }

    const subtotalPaise = cart.items.reduce((sum, i) => sum + i.unitPricePaise * i.quantity, 0);
    const discount = await findApplicableDiscountByCode(db, sid, body.data.code, subtotalPaise);
    const discountTotalPaise = computeDiscountPaise(discount.type, discount.value, subtotalPaise);
    await db
      .update(carts)
      .set({
        discountCode: normalizeDiscountCode(discount.code),
        discountTotalPaise,
        subtotalPaise,
        updatedAt: new Date(),
      })
      .where(eq(carts.id, cart.id));
    return sendSuccess(c, await loadPresentedCart(db, sid, cart.id), {
      message: SUCCESS_MESSAGES.DISCOUNT_APPLIED,
    });
  });

  app.post("/carts/:cartId/shipping-address", async (c) => {
    const body = addressBodySchema
      .omit({ isDefault: true })
      .safeParse(await c.req.json());
    if (!body.success) throw new ValidationError("Invalid address.", body.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const sid = storeId(c);
    const [cart] = await db
      .update(carts)
      .set({
        shippingName: body.data.name,
        shippingPhone: body.data.phone ?? null,
        shippingAddressLine1: body.data.addressLine1,
        shippingAddressLine2: body.data.addressLine2 ?? null,
        shippingCity: body.data.city,
        shippingState: body.data.state ?? null,
        shippingPostalCode: body.data.postalCode,
        shippingCountry: body.data.country ?? "IN",
        updatedAt: new Date(),
      })
      .where(and(eq(carts.id, c.req.param("cartId")), eq(carts.storeId, sid)))
      .returning();
    if (!cart) throw new NotFoundError("Cart not found.");
    return sendSuccess(c, await loadPresentedCart(db, sid, cart.id), {
      message: SUCCESS_MESSAGES.CART_ADDRESS_UPDATED,
    });
  });

  app.post("/carts/:cartId/shipping-address/from-saved", async (c) => {
    const body = z.object({ addressId: z.string().uuid() }).safeParse(await c.req.json());
    if (!body.success) throw new ValidationError("Invalid address id.", body.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const sid = storeId(c);
    const customerId = await requireCustomerId(c, sid);
    const address = await db.query.customerAddresses.findFirst({
      where: and(
        eq(customerAddresses.id, body.data.addressId),
        eq(customerAddresses.storeId, sid),
        eq(customerAddresses.customerId, customerId),
      ),
    });
    if (!address) throw new NotFoundError("Address not found.");
    const [cart] = await db
      .update(carts)
      .set({
        customerId,
        ...shippingFieldsFromAddress(address),
        updatedAt: new Date(),
      })
      .where(and(eq(carts.id, c.req.param("cartId")), eq(carts.storeId, sid)))
      .returning();
    if (!cart) throw new NotFoundError("Cart not found.");
    return sendSuccess(c, await loadPresentedCart(db, sid, cart.id), {
      message: SUCCESS_MESSAGES.CART_ADDRESS_UPDATED,
    });
  });

  app.post("/carts/:cartId/shipping-address/save", async (c) => {
    const body = saveCartShippingSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) throw new ValidationError("Invalid address.", body.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const sid = storeId(c);
    const customerId = await requireCustomerId(c, sid);
    const cart = await loadCart(db, sid, c.req.param("cartId"));
    if (!cartHasShippingSnapshot(cart)) {
      throw new ValidationError("Shipping address is required.");
    }
    const address = await insertCustomerAddress(db, sid, customerId, {
      name: cart.shippingName!,
      phone: cart.shippingPhone,
      addressLine1: cart.shippingAddressLine1!,
      addressLine2: cart.shippingAddressLine2,
      city: cart.shippingCity!,
      state: cart.shippingState,
      postalCode: cart.shippingPostalCode!,
      country: cart.shippingCountry ?? "IN",
      isDefault: body.data.isDefault,
    });
    if (!cart.customerId) {
      await db
        .update(carts)
        .set({ customerId, updatedAt: new Date() })
        .where(eq(carts.id, cart.id));
    }
    return sendSuccess(c, address, {
      message: SUCCESS_MESSAGES.ADDRESS_CREATED,
      status: HTTP_STATUS.CREATED,
    });
  });

  app.post("/carts/:cartId/checkout", async (c) => {
    const checkoutBody = z
      .object({
        discountCode: z.string().min(1).optional(),
        email: z.string().email().optional(),
      })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!checkoutBody.success) {
      throw new ValidationError("Invalid checkout.", checkoutBody.error.flatten());
    }

    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const sid = storeId(c);
    const optionalCustomerId = await resolveOptionalCustomerId(c, sid);
    const idempotencyKey = c.req.header(IDEMPOTENCY_KEY_HEADER) ?? null;
    if (idempotencyKey) {
      const existing = await db.query.orders.findFirst({
        where: and(eq(orders.storeId, sid), eq(orders.idempotencyKey, idempotencyKey)),
        with: { items: true },
      });
      if (existing) {
        return sendSuccess(c, existing, { message: SUCCESS_MESSAGES.ORDER_RETRIEVED });
      }
    }

    let cart = await loadCart(db, sid, c.req.param("cartId"));
    if (cart.status !== "ACTIVE") throw new ValidationError("Cart is not active.");
    if (!cart.items.length) throw new ValidationError("Cart is empty.");
    if (!cart.shippingName || !cart.shippingAddressLine1 || !cart.shippingCity || !cart.shippingPostalCode) {
      throw new ValidationError("Shipping address is required.");
    }

    if (optionalCustomerId) {
      if (cart.customerId && cart.customerId !== optionalCustomerId) {
        throw new ValidationError("Cart already belongs to another customer.");
      }
      if (!cart.customerId) {
        await db
          .update(carts)
          .set({ customerId: optionalCustomerId, updatedAt: new Date() })
          .where(eq(carts.id, cart.id));
        cart = await loadCart(db, sid, cart.id);
      }
    }

    let orderEmail: string | null = null;
    if (checkoutBody.data.email) {
      orderEmail = normalizeEmail(checkoutBody.data.email);
    } else if (cart.email) {
      orderEmail = normalizeEmail(cart.email);
    } else if (cart.customerId) {
      const customer = await db.query.customers.findFirst({
        where: and(eq(customers.id, cart.customerId), eq(customers.storeId, sid)),
      });
      orderEmail = customer?.email ? normalizeEmail(customer.email) : null;
    }
    if (!orderEmail) {
      throw new ValidationError("Email is required for checkout.");
    }
    if (!cart.email || normalizeEmail(cart.email) !== orderEmail) {
      await db
        .update(carts)
        .set({ email: orderEmail, updatedAt: new Date() })
        .where(eq(carts.id, cart.id));
      cart = await loadCart(db, sid, cart.id);
    }

    const codeToApply = checkoutBody.data.discountCode ?? cart.discountCode ?? null;
    let discountCode: string | null = null;
    let discountTotalPaise = 0;
    let discountId: string | null = null;
    const subtotalPaise = cart.items.reduce((sum, i) => sum + i.unitPricePaise * i.quantity, 0);
    if (codeToApply) {
      const discount = await findApplicableDiscountByCode(db, sid, codeToApply, subtotalPaise);
      discountId = discount.id;
      discountCode = normalizeDiscountCode(discount.code);
      discountTotalPaise = computeDiscountPaise(discount.type, discount.value, subtotalPaise);
    }
    const commerce = await loadStoreCommerceSettings(db, sid);
    const { taxTotalPaise, shippingTotalPaise, grandTotalPaise } = computeCheckoutTotals(
      subtotalPaise,
      discountTotalPaise,
      { shipping: commerce.shipping, tax: commerce.tax },
    );

    for (const item of cart.items) {
      const stock = await db.query.inventory.findFirst({
        where: and(eq(inventory.storeId, sid), eq(inventory.variantId, item.variantId)),
      });
      if (!stock || stock.availableQuantity < item.quantity) {
        throw new InsufficientStockError();
      }
    }

    const orderNumber = `ORD-${Date.now()}`;
    const {
      clearInventoryReservation,
      coordinateInventory,
    } = await import("@/modules/inventory/inventory-do");

    for (const item of cart.items) {
      await coordinateInventory(c, sid, item.variantId, `checkout:${cart.id}`, item.quantity);
    }

    try {
      const full = await db.transaction(async (tx) => {
        const [order] = await tx
          .insert(orders)
          .values({
            storeId: sid,
            orderNumber,
            customerId: cart.customerId,
            email: orderEmail,
            status: "PENDING",
            idempotencyKey,
            subtotalPaise,
            discountCode,
            discountTotalPaise,
            taxTotalPaise,
            shippingTotalPaise,
            grandTotalPaise,
            currency: "INR",
            shippingName: cart.shippingName!,
            shippingPhone: cart.shippingPhone,
            shippingAddressLine1: cart.shippingAddressLine1!,
            shippingAddressLine2: cart.shippingAddressLine2,
            shippingCity: cart.shippingCity!,
            shippingState: cart.shippingState,
            shippingPostalCode: cart.shippingPostalCode!,
            shippingCountry: cart.shippingCountry ?? "IN",
          })
          .returning();

        for (const item of cart.items) {
          const variant = await findSellableVariant(tx as typeof db, sid, item.variantId);
          await tx.insert(orderItems).values({
            storeId: sid,
            orderId: order!.id,
            productId: variant?.productId ?? null,
            variantId: item.variantId,
            source: variant?.source ?? item.source ?? "STORE",
            productTitle: variant?.productTitle ?? "Product",
            variantTitle: variant?.title ?? "Variant",
            sku: variant?.sku ?? "UNKNOWN",
            unitPricePaise: item.unitPricePaise,
            quantity: item.quantity,
            lineTotalPaise: item.unitPricePaise * item.quantity,
          });

          const stock = await tx.query.inventory.findFirst({
            where: and(eq(inventory.storeId, sid), eq(inventory.variantId, item.variantId)),
          });
          if (!stock || stock.availableQuantity < item.quantity) {
            throw new InsufficientStockError();
          }
          await tx
            .update(inventory)
            .set({
              availableQuantity: stock.availableQuantity - item.quantity,
              updatedAt: new Date(),
            })
            .where(eq(inventory.id, stock.id));
          await tx.insert(inventoryMovements).values({
            storeId: sid,
            variantId: item.variantId,
            source: variant?.source ?? item.source ?? "STORE",
            type: "SALE",
            quantity: -item.quantity,
            reference: order!.id,
          });
        }

        await tx
          .update(carts)
          .set({
            status: "CHECKED_OUT",
            discountCode,
            discountTotalPaise,
            subtotalPaise,
            updatedAt: new Date(),
          })
          .where(eq(carts.id, cart.id));

        if (discountId) {
          const incremented = await tryIncrementDiscountUsage(tx as typeof db, sid, discountId);
          if (!incremented) {
            throw new InvalidStateError("Discount usage limit reached.");
          }
        }

        return tx.query.orders.findFirst({
          where: eq(orders.id, order!.id),
          with: { items: true },
        });
      });

      for (const item of cart.items) {
        await clearInventoryReservation(c, sid, item.variantId, `checkout:${cart.id}`);
      }

      if (full) {
        const store = await db.query.stores.findFirst({ where: eq(stores.id, sid) });
        const settings = await db.query.storeSettings.findMany({
          where: eq(storeSettings.storeId, sid),
        });
        const settingsMap = Object.fromEntries(settings.map((item) => [item.key, item.value]));
        const contactEmail =
          typeof settingsMap.contactEmail === "string" && settingsMap.contactEmail.trim()
            ? settingsMap.contactEmail.trim()
            : null;
        await notifyOrderPlaced({
          config: zeptoMailConfigFromEnv(c.env),
          storeName: store?.name ?? "Store",
          replyTo: contactEmail,
          order: full,
        });
      }

      return sendSuccess(c, full, {
        message: SUCCESS_MESSAGES.ORDER_CREATED,
        status: HTTP_STATUS.CREATED,
      });
    } catch (error) {
      for (const item of cart.items) {
        await clearInventoryReservation(c, sid, item.variantId, `checkout:${cart.id}`);
      }
      throw error;
    }
  });

  // Customer auth (storefront)
  app.post("/auth/register", async (c) => {
    const body = z
      .object({
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string().min(1),
        phone: z.string().optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) throw new ValidationError("Invalid registration.", body.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const sid = storeId(c);
    const email = normalizeEmail(body.data.email);
    const existing = await db.query.customers.findFirst({
      where: and(eq(customers.storeId, sid), eq(customers.email, email)),
    });
    if (existing) throw new ValidationError("Customer already exists.");
    const [customer] = await db
      .insert(customers)
      .values({
        storeId: sid,
        email,
        name: body.data.name,
        phone: body.data.phone ?? null,
        passwordHash: await hashPassword(body.data.password),
      })
      .returning();
    const accessToken = await signAuthToken(
      { sub: customer!.id, storeId: sid, typ: "customer" },
      { secret: c.env?.JWT_SECRET || process.env.JWT_SECRET },
    );
    return sendSuccess(
      c,
      {
        accessToken,
        customer: presentCustomer(customer!),
      },
      {
        message: SUCCESS_MESSAGES.CUSTOMER_REGISTERED,
        status: HTTP_STATUS.CREATED,
      },
    );
  });

  app.post("/auth/login", async (c) => {
    const body = z
      .object({ email: z.string().email(), password: z.string().min(1) })
      .safeParse(await c.req.json());
    if (!body.success) throw new ValidationError("Invalid login.", body.error.flatten());
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const sid = storeId(c);
    const customer = await db.query.customers.findFirst({
      where: and(eq(customers.storeId, sid), eq(customers.email, normalizeEmail(body.data.email))),
    });
    if (!customer?.passwordHash || !(await verifyPassword(body.data.password, customer.passwordHash))) {
      throw new UnauthorizedError("Invalid email or password.");
    }
    const accessToken = await signAuthToken(
      { sub: customer.id, storeId: sid, typ: "customer" },
      { secret: c.env?.JWT_SECRET || process.env.JWT_SECRET },
    );
    return sendSuccess(
      c,
      {
        accessToken,
        customer: presentCustomer(customer),
      },
      { message: SUCCESS_MESSAGES.CUSTOMER_LOGGED_IN },
    );
  });

  app.get("/auth/me", async (c) => {
    const sid = storeId(c);
    const customerId = await requireCustomerId(c, sid);
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const customer = await db.query.customers.findFirst({
      where: and(eq(customers.id, customerId), eq(customers.storeId, sid)),
    });
    if (!customer) throw new UnauthorizedError();
    return sendSuccess(c, presentCustomer(customer), { message: SUCCESS_MESSAGES.CUSTOMER_RETRIEVED });
  });

  app.patch("/auth/me", async (c) => {
    const body = updateCustomerProfileSchema.safeParse(await c.req.json());
    if (!body.success) throw new ValidationError("Invalid profile.", body.error.flatten());
    const sid = storeId(c);
    const customerId = await requireCustomerId(c, sid);
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const updated = await updateCustomerProfile(db, sid, customerId, body.data);
    if (!updated) throw new UnauthorizedError();
    return sendSuccess(c, presentCustomer(updated), { message: SUCCESS_MESSAGES.CUSTOMER_UPDATED });
  });

  app.get("/orders", async (c) => {
    const sid = storeId(c);
    const customerId = await requireCustomerId(c, sid);
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const items = await db.query.orders.findMany({
      where: and(eq(orders.storeId, sid), eq(orders.customerId, customerId)),
      orderBy: [desc(orders.createdAt)],
    });
    return sendSuccess(c, items, { message: SUCCESS_MESSAGES.ORDERS_RETRIEVED });
  });

  app.get("/orders/lookup", async (c) => {
    const parsed = z
      .object({
        orderNumber: z.string().trim().min(1),
        email: z.string().email(),
      })
      .safeParse(c.req.query());
    if (!parsed.success) {
      throw new ValidationError("orderNumber and email are required.", parsed.error.flatten());
    }
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const sid = storeId(c);
    const email = normalizeEmail(parsed.data.email);
    const order = await db.query.orders.findFirst({
      where: and(
        eq(orders.storeId, sid),
        eq(orders.orderNumber, parsed.data.orderNumber.trim()),
        eq(orders.email, email),
      ),
      with: {
        items: true,
        returns: { orderBy: [desc(orderReturns.createdAt)] },
      },
    });
    if (!order) throw new NotFoundError("Order not found.");
    return sendSuccess(c, order, { message: SUCCESS_MESSAGES.ORDER_LOOKUP_RETRIEVED });
  });

  app.get("/orders/:orderId", async (c) => {
    const sid = storeId(c);
    const customerId = await requireCustomerId(c, sid);
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const order = await db.query.orders.findFirst({
      where: and(
        eq(orders.id, c.req.param("orderId")),
        eq(orders.storeId, sid),
        eq(orders.customerId, customerId),
      ),
      with: {
        items: true,
        returns: { orderBy: [desc(orderReturns.createdAt)] },
      },
    });
    if (!order) throw new NotFoundError("Order not found.");
    return sendSuccess(c, order, { message: SUCCESS_MESSAGES.ORDER_RETRIEVED });
  });

  app.post("/orders/:orderId/return", async (c) => {
    const body = z
      .object({
        reason: z.string().trim().min(3).max(1000),
      })
      .safeParse(await c.req.json());
    if (!body.success) throw new ValidationError("Invalid return request.", body.error.flatten());

    const sid = storeId(c);
    const customerId = await requireCustomerId(c, sid);
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);

    const order = await db.query.orders.findFirst({
      where: and(
        eq(orders.id, c.req.param("orderId")),
        eq(orders.storeId, sid),
        eq(orders.customerId, customerId),
      ),
    });
    if (!order) throw new NotFoundError("Order not found.");
    assertOrderCanRequestReturn(order.status);

    const blocking = await findBlockingReturn(db, sid, order.id);
    if (blocking) {
      throw new DuplicateResourceError("A return is already open or approved for this order.");
    }

    const [created] = await db
      .insert(orderReturns)
      .values({
        storeId: sid,
        orderId: order.id,
        customerId,
        status: "REQUESTED",
        reason: body.data.reason,
      })
      .returning();

    return sendSuccess(c, created, {
      message: SUCCESS_MESSAGES.RETURN_REQUESTED,
      status: HTTP_STATUS.CREATED,
    });
  });

  app.get("/addresses", async (c) => {
    const sid = storeId(c);
    const customerId = await requireCustomerId(c, sid);
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const items = await listCustomerAddresses(db, sid, customerId);
    return sendSuccess(c, items, { message: SUCCESS_MESSAGES.ADDRESSES_RETRIEVED });
  });

  app.get("/addresses/:addressId", async (c) => {
    const sid = storeId(c);
    const customerId = await requireCustomerId(c, sid);
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const address = await getCustomerAddress(db, sid, customerId, c.req.param("addressId"));
    if (!address) throw new NotFoundError("Address not found.");
    return sendSuccess(c, address, { message: SUCCESS_MESSAGES.ADDRESS_RETRIEVED });
  });

  app.post("/addresses", async (c) => {
    const body = addressBodySchema.safeParse(await c.req.json());
    if (!body.success) throw new ValidationError("Invalid address.", body.error.flatten());
    const sid = storeId(c);
    const customerId = await requireCustomerId(c, sid);
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const created = await insertCustomerAddress(db, sid, customerId, body.data);
    return sendSuccess(c, created, {
      message: SUCCESS_MESSAGES.ADDRESS_CREATED,
      status: HTTP_STATUS.CREATED,
    });
  });

  app.patch("/addresses/:addressId", async (c) => {
    const body = updateAddressBodySchema.safeParse(await c.req.json());
    if (!body.success) throw new ValidationError("Invalid address.", body.error.flatten());
    const sid = storeId(c);
    const customerId = await requireCustomerId(c, sid);
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);

    const updated = await db.transaction(async (tx) => {
      if (body.data.isDefault) {
        await tx
          .update(customerAddresses)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(
            and(eq(customerAddresses.storeId, sid), eq(customerAddresses.customerId, customerId)),
          );
      }
      const [address] = await tx
        .update(customerAddresses)
        .set({
          ...("name" in body.data ? { name: body.data.name } : {}),
          ...("phone" in body.data ? { phone: body.data.phone ?? null } : {}),
          ...("addressLine1" in body.data ? { addressLine1: body.data.addressLine1 } : {}),
          ...("addressLine2" in body.data ? { addressLine2: body.data.addressLine2 ?? null } : {}),
          ...("city" in body.data ? { city: body.data.city } : {}),
          ...("state" in body.data ? { state: body.data.state ?? null } : {}),
          ...("postalCode" in body.data ? { postalCode: body.data.postalCode } : {}),
          ...("country" in body.data ? { country: body.data.country } : {}),
          ...("isDefault" in body.data ? { isDefault: body.data.isDefault ?? false } : {}),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(customerAddresses.id, c.req.param("addressId")),
            eq(customerAddresses.storeId, sid),
            eq(customerAddresses.customerId, customerId),
          ),
        )
        .returning();
      return address;
    });

    if (!updated) throw new NotFoundError("Address not found.");
    return sendSuccess(c, updated, { message: SUCCESS_MESSAGES.ADDRESS_UPDATED });
  });

  app.delete("/addresses/:addressId", async (c) => {
    const sid = storeId(c);
    const customerId = await requireCustomerId(c, sid);
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const deleted = await deleteCustomerAddress(db, sid, customerId, c.req.param("addressId"));
    if (!deleted) throw new NotFoundError("Address not found.");
    return sendSuccess(c, { deleted: true }, { message: SUCCESS_MESSAGES.ADDRESS_DELETED });
  });

  app.get("/wishlist", async (c) => {
    const sid = storeId(c);
    const customerId = await requireCustomerId(c, sid);
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const items = await db.query.wishlistItems.findMany({
      where: and(eq(wishlistItems.storeId, sid), eq(wishlistItems.customerId, customerId)),
      orderBy: [desc(wishlistItems.createdAt)],
    });
    const stocks = await db.query.inventory.findMany({
      where: eq(inventory.storeId, sid),
    });
    const stockByVariant = new Map(stocks.map((s) => [s.variantId, s.availableQuantity]));
    const data = [];
    for (const item of items) {
      const variant = await findSellableVariant(db, sid, item.variantId);
      data.push({
        id: item.id,
        storeId: item.storeId,
        customerId: item.customerId,
        variantId: item.variantId,
        source: item.source,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        variant: variant
          ? {
              id: variant.variantId,
              productId: variant.productId,
              sku: variant.sku,
              title: variant.title,
              pricePaise: variant.pricePaise,
              compareAtPricePaise: variant.compareAtPricePaise,
              status: variant.status,
              availableQuantity: stockByVariant.get(variant.variantId) ?? 0,
              source: variant.source,
            }
          : null,
        product: variant
          ? {
              id: variant.productId,
              title: variant.productTitle,
              handle: variant.productHandle,
              status: "ACTIVE",
              source: variant.source,
            }
          : null,
      });
    }
    return sendSuccess(c, data, { message: SUCCESS_MESSAGES.WISHLIST_RETRIEVED });
  });

  app.post("/wishlist", async (c) => {
    const body = z
      .object({ variantId: z.string().uuid() })
      .safeParse(await c.req.json());
    if (!body.success) throw new ValidationError("Invalid wishlist item.", body.error.flatten());
    const sid = storeId(c);
    const customerId = await requireCustomerId(c, sid);
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);

    const variant = await findSellableVariant(db, sid, body.data.variantId);
    if (!variant || variant.status !== "ACTIVE") throw new NotFoundError("Variant not found.");

    const existing = await db.query.wishlistItems.findFirst({
      where: and(
        eq(wishlistItems.storeId, sid),
        eq(wishlistItems.customerId, customerId),
        eq(wishlistItems.variantId, body.data.variantId),
      ),
    });
    if (existing) {
      return sendSuccess(c, existing, { message: SUCCESS_MESSAGES.WISHLIST_ITEM_ADDED });
    }

    const [created] = await db
      .insert(wishlistItems)
      .values({
        storeId: sid,
        customerId,
        variantId: body.data.variantId,
        source: variant.source,
      })
      .returning();

    return sendSuccess(c, created, {
      message: SUCCESS_MESSAGES.WISHLIST_ITEM_ADDED,
      status: HTTP_STATUS.CREATED,
    });
  });

  app.delete("/wishlist/variants/:variantId", async (c) => {
    const sid = storeId(c);
    const customerId = await requireCustomerId(c, sid);
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const deleted = await db
      .delete(wishlistItems)
      .where(
        and(
          eq(wishlistItems.variantId, c.req.param("variantId")),
          eq(wishlistItems.storeId, sid),
          eq(wishlistItems.customerId, customerId),
        ),
      )
      .returning({ id: wishlistItems.id });
    if (!deleted.length) throw new NotFoundError("Wishlist item not found.");
    return sendSuccess(c, { deleted: true }, { message: SUCCESS_MESSAGES.WISHLIST_ITEM_REMOVED });
  });

  app.delete("/wishlist/:itemId", async (c) => {
    const sid = storeId(c);
    const customerId = await requireCustomerId(c, sid);
    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);
    const deleted = await db
      .delete(wishlistItems)
      .where(
        and(
          eq(wishlistItems.id, c.req.param("itemId")),
          eq(wishlistItems.storeId, sid),
          eq(wishlistItems.customerId, customerId),
        ),
      )
      .returning({ id: wishlistItems.id });
    if (!deleted.length) throw new NotFoundError("Wishlist item not found.");
    return sendSuccess(c, { deleted: true }, { message: SUCCESS_MESSAGES.WISHLIST_ITEM_REMOVED });
  });

  return app;
}
