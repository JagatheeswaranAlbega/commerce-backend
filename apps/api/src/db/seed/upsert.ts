import { and, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { apiKeys } from "@/db/schema/api-keys";
import { cartLineItems } from "@/db/schema/cart-line-items";
import { carts } from "@/db/schema/carts";
import { categories } from "@/db/schema/categories";
import { collectionProducts } from "@/db/schema/collection-products";
import { collections } from "@/db/schema/collections";
import { customerAddresses } from "@/db/schema/customer-addresses";
import { customers } from "@/db/schema/customers";
import { discounts } from "@/db/schema/discounts";
import { inventory } from "@/db/schema/inventory";
import { orderItems } from "@/db/schema/order-items";
import { orders } from "@/db/schema/orders";
import { productImages } from "@/db/schema/product-images";
import { productVariants } from "@/db/schema/product-variants";
import { products } from "@/db/schema/products";
import { storeSettings } from "@/db/schema/store-settings";
import { stores } from "@/db/schema/stores";
import { users } from "@/db/schema/users";
import { generateApiKey, sha256Hex } from "@/infrastructure/crypto/api-key";
import { toR2Url } from "@/infrastructure/r2/product-media";
import { computeCheckoutTotals } from "@/modules/checkout/totals";
import { normalizeEmail, normalizeSlug } from "@/shared/tenant/normalize";
import type {
  DemoStoreSeed,
  FixtureStoreSeed,
  SeededStoreSummary,
  SeedStoreSettings,
} from "./types";

export async function ensureApiKey(
  db: Database,
  storeId: string,
  type: "PUBLISHABLE" | "SECRET",
): Promise<string> {
  const existing = await db.query.apiKeys.findFirst({
    where: and(
      eq(apiKeys.storeId, storeId),
      eq(apiKeys.type, type),
      eq(apiKeys.status, "ACTIVE"),
    ),
  });
  if (existing) {
    return `${existing.keyPrefix}… (existing; not rotated)`;
  }
  const { rawKey, prefix } = generateApiKey(type);
  const secretHash = await sha256Hex(rawKey);
  await db.insert(apiKeys).values({
    storeId,
    type,
    keyPrefix: prefix,
    secretHash,
    status: "ACTIVE",
  });
  return rawKey;
}

export async function upsertStore(
  db: Database,
  name: string,
  slugInput: string,
): Promise<{ id: string; slug: string }> {
  const slug = normalizeSlug(slugInput);
  const existing = await db.query.stores.findFirst({ where: eq(stores.slug, slug) });
  if (existing) {
    await db
      .update(stores)
      .set({ name, status: "ACTIVE", updatedAt: new Date() })
      .where(eq(stores.id, existing.id));
    return { id: existing.id, slug };
  }
  const [created] = await db
    .insert(stores)
    .values({ name, slug, status: "ACTIVE" })
    .returning();
  return { id: created!.id, slug };
}

export async function upsertStoreAdmin(
  db: Database,
  emailInput: string,
  passwordHash: string,
  storeId: string,
): Promise<string> {
  const email = normalizeEmail(emailInput);
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) {
    await db
      .update(users)
      .set({
        passwordHash,
        role: "STORE_ADMIN",
        storeId,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id));
    return email;
  }
  await db.insert(users).values({
    email,
    passwordHash,
    role: "STORE_ADMIN",
    storeId,
    isActive: true,
  });
  return email;
}

export async function ensureStoreSettings(
  db: Database,
  storeId: string,
  settings: SeedStoreSettings,
): Promise<void> {
  const entries: Array<{ key: string; value: unknown }> = [
    { key: "currency", value: settings.currency },
    { key: "timezone", value: settings.timezone },
    { key: "shipping", value: settings.shipping },
    { key: "tax", value: settings.tax },
  ];
  for (const setting of entries) {
    const existing = await db.query.storeSettings.findFirst({
      where: and(eq(storeSettings.storeId, storeId), eq(storeSettings.key, setting.key)),
    });
    if (!existing) {
      await db.insert(storeSettings).values({
        storeId,
        key: setting.key,
        value: setting.value,
      });
    }
  }
}

async function ensureCategory(
  db: Database,
  storeId: string,
  name: string,
  slug: string,
  parentId: string | null,
): Promise<string> {
  const existing = await db.query.categories.findFirst({
    where: and(eq(categories.storeId, storeId), eq(categories.slug, slug)),
  });
  if (existing) return existing.id;
  const [created] = await db
    .insert(categories)
    .values({
      storeId,
      name,
      slug,
      parentId,
      status: "ACTIVE",
    })
    .returning({ id: categories.id });
  return created!.id;
}

async function ensureCollection(
  db: Database,
  storeId: string,
  name: string,
  slug: string,
  description: string,
): Promise<string> {
  const existing = await db.query.collections.findFirst({
    where: and(eq(collections.storeId, storeId), eq(collections.slug, slug)),
  });
  if (existing) return existing.id;
  const [created] = await db
    .insert(collections)
    .values({
      storeId,
      name,
      slug,
      description,
      status: "ACTIVE",
    })
    .returning({ id: collections.id });
  return created!.id;
}

async function ensureProduct(
  db: Database,
  storeId: string,
  categoryId: string | null,
  product: {
    title: string;
    handle: string;
    shortDescription: string;
    description: string;
  },
): Promise<string> {
  const existing = await db.query.products.findFirst({
    where: and(eq(products.storeId, storeId), eq(products.handle, product.handle)),
  });
  if (existing) return existing.id;
  const [created] = await db
    .insert(products)
    .values({
      storeId,
      categoryId,
      title: product.title,
      handle: product.handle,
      shortDescription: product.shortDescription,
      description: product.description,
      status: "ACTIVE",
    })
    .returning({ id: products.id });
  return created!.id;
}

async function ensureVariantWithInventory(
  db: Database,
  storeId: string,
  productId: string,
  variant: {
    sku: string;
    title: string;
    pricePaise: number;
    compareAtPricePaise?: number;
    availableQuantity: number;
  },
): Promise<{ id: string; pricePaise: number; title: string; sku: string }> {
  const existing = await db.query.productVariants.findFirst({
    where: and(eq(productVariants.storeId, storeId), eq(productVariants.sku, variant.sku)),
  });
  let variantId: string;
  let pricePaise: number;
  let title: string;
  let sku: string;
  if (existing) {
    variantId = existing.id;
    pricePaise = existing.pricePaise;
    title = existing.title;
    sku = existing.sku;
  } else {
    const [created] = await db
      .insert(productVariants)
      .values({
        storeId,
        productId,
        sku: variant.sku,
        title: variant.title,
        pricePaise: variant.pricePaise,
        compareAtPricePaise: variant.compareAtPricePaise ?? null,
        status: "ACTIVE",
      })
      .returning();
    variantId = created!.id;
    pricePaise = created!.pricePaise;
    title = created!.title;
    sku = created!.sku;
  }

  const existingInv = await db.query.inventory.findFirst({
    where: and(eq(inventory.storeId, storeId), eq(inventory.variantId, variantId)),
  });
  if (!existingInv) {
    await db.insert(inventory).values({
      storeId,
      variantId,
      availableQuantity: variant.availableQuantity,
      reservedQuantity: 0,
    });
  }

  return { id: variantId, pricePaise, title, sku };
}

async function ensureProductImage(
  db: Database,
  storeId: string,
  productId: string,
  handle: string,
): Promise<void> {
  const storageKey = `stores/${storeId}/products/${productId}/seed-${handle}-1.jpg`;
  const existing = await db.query.productImages.findFirst({
    where: and(
      eq(productImages.storeId, storeId),
      eq(productImages.productId, productId),
      eq(productImages.storageKey, storageKey),
    ),
  });
  if (existing) return;
  await db.insert(productImages).values({
    storeId,
    productId,
    storageKey,
    url: toR2Url(storageKey),
    altText: handle.replace(/-/g, " "),
    sortOrder: 0,
    isThumbnail: true,
  });
}

async function ensureCollectionProduct(
  db: Database,
  storeId: string,
  collectionId: string,
  productId: string,
): Promise<void> {
  const existing = await db.query.collectionProducts.findFirst({
    where: and(
      eq(collectionProducts.collectionId, collectionId),
      eq(collectionProducts.productId, productId),
    ),
  });
  if (existing) return;
  await db.insert(collectionProducts).values({
    storeId,
    collectionId,
    productId,
  });
}

async function ensureCustomer(
  db: Database,
  storeId: string,
  def: DemoStoreSeed["customers"][number],
): Promise<string> {
  const email = normalizeEmail(def.email);
  const existing = await db.query.customers.findFirst({
    where: and(eq(customers.storeId, storeId), eq(customers.email, email)),
  });
  let customerId: string;
  if (existing) {
    customerId = existing.id;
  } else {
    const [created] = await db
      .insert(customers)
      .values({
        storeId,
        email,
        name: def.name,
        phone: def.phone,
      })
      .returning({ id: customers.id });
    customerId = created!.id;
  }

  const existingAddr = await db.query.customerAddresses.findFirst({
    where: and(
      eq(customerAddresses.storeId, storeId),
      eq(customerAddresses.customerId, customerId),
      eq(customerAddresses.isDefault, true),
    ),
  });
  if (!existingAddr) {
    await db.insert(customerAddresses).values({
      storeId,
      customerId,
      name: def.address.name,
      phone: def.address.phone,
      addressLine1: def.address.addressLine1,
      addressLine2: def.address.addressLine2 ?? null,
      city: def.address.city,
      state: def.address.state,
      postalCode: def.address.postalCode,
      country: def.address.country ?? "IN",
      isDefault: true,
    });
  }
  return customerId;
}

async function ensureDiscount(
  db: Database,
  storeId: string,
  def: DemoStoreSeed["discounts"][number],
): Promise<void> {
  const existing = await db.query.discounts.findFirst({
    where: and(eq(discounts.storeId, storeId), eq(discounts.code, def.code)),
  });
  if (existing) return;
  await db.insert(discounts).values({
    storeId,
    code: def.code,
    type: def.type,
    value: def.value,
    status: "ACTIVE",
    minOrderPaise: def.minOrderPaise ?? null,
    usageLimit: def.usageLimit ?? null,
    usageCount: 0,
  });
}

async function ensureCart(
  db: Database,
  storeId: string,
  customerId: string,
  customerEmail: string,
  shipping: DemoStoreSeed["customers"][number]["address"],
  lineItems: Array<{ variantId: string; quantity: number; unitPricePaise: number }>,
): Promise<void> {
  const email = normalizeEmail(customerEmail);
  const existing = await db.query.carts.findFirst({
    where: and(
      eq(carts.storeId, storeId),
      eq(carts.email, email),
      eq(carts.status, "ACTIVE"),
    ),
  });
  if (existing) return;

  const subtotalPaise = lineItems.reduce(
    (sum, item) => sum + item.unitPricePaise * item.quantity,
    0,
  );
  const [cart] = await db
    .insert(carts)
    .values({
      storeId,
      customerId,
      email,
      status: "ACTIVE",
      shippingName: shipping.name,
      shippingPhone: shipping.phone,
      shippingAddressLine1: shipping.addressLine1,
      shippingAddressLine2: shipping.addressLine2 ?? null,
      shippingCity: shipping.city,
      shippingState: shipping.state,
      shippingPostalCode: shipping.postalCode,
      shippingCountry: shipping.country ?? "IN",
      subtotalPaise,
      discountTotalPaise: 0,
    })
    .returning({ id: carts.id });

  for (const item of lineItems) {
    await db.insert(cartLineItems).values({
      storeId,
      cartId: cart!.id,
      variantId: item.variantId,
      quantity: item.quantity,
      unitPricePaise: item.unitPricePaise,
    });
  }
}

async function ensureOrder(
  db: Database,
  storeId: string,
  def: DemoStoreSeed["orders"][number],
  customerId: string,
  customer: DemoStoreSeed["customers"][number],
  resolvedItems: Array<{
    productId: string;
    variantId: string;
    productTitle: string;
    variantTitle: string;
    sku: string;
    unitPricePaise: number;
    quantity: number;
  }>,
  settings: SeedStoreSettings,
): Promise<void> {
  const existing = await db.query.orders.findFirst({
    where: and(eq(orders.storeId, storeId), eq(orders.orderNumber, def.orderNumber)),
  });
  if (existing) return;

  const subtotalPaise = resolvedItems.reduce(
    (sum, item) => sum + item.unitPricePaise * item.quantity,
    0,
  );

  let discountTotalPaise = 0;
  if (def.discountCode) {
    const discount = await db.query.discounts.findFirst({
      where: and(eq(discounts.storeId, storeId), eq(discounts.code, def.discountCode)),
    });
    if (discount) {
      if (discount.type === "PERCENTAGE") {
        discountTotalPaise = Math.floor((subtotalPaise * discount.value) / 100);
      } else {
        discountTotalPaise = Math.min(subtotalPaise, discount.value);
      }
    }
  }

  const totals = computeCheckoutTotals(subtotalPaise, discountTotalPaise, {
    shipping: settings.shipping,
    tax: settings.tax,
  });

  const [order] = await db
    .insert(orders)
    .values({
      storeId,
      orderNumber: def.orderNumber,
      customerId,
      email: normalizeEmail(customer.email),
      status: def.status,
      subtotalPaise,
      discountCode: def.discountCode ?? null,
      discountTotalPaise,
      taxTotalPaise: totals.taxTotalPaise,
      shippingTotalPaise: totals.shippingTotalPaise,
      grandTotalPaise: totals.grandTotalPaise,
      currency: "INR",
      shippingName: customer.address.name,
      shippingPhone: customer.address.phone,
      shippingAddressLine1: customer.address.addressLine1,
      shippingAddressLine2: customer.address.addressLine2 ?? null,
      shippingCity: customer.address.city,
      shippingState: customer.address.state,
      shippingPostalCode: customer.address.postalCode,
      shippingCountry: customer.address.country ?? "IN",
      trackingNumber: def.status === "SHIPPED" || def.status === "DELIVERED" ? `TRK-${def.orderNumber}` : null,
      carrier: def.status === "SHIPPED" || def.status === "DELIVERED" ? "Delhivery" : null,
    })
    .returning({ id: orders.id });

  for (const item of resolvedItems) {
    await db.insert(orderItems).values({
      storeId,
      orderId: order!.id,
      productId: item.productId,
      variantId: item.variantId,
      productTitle: item.productTitle,
      variantTitle: item.variantTitle,
      sku: item.sku,
      unitPricePaise: item.unitPricePaise,
      quantity: item.quantity,
      lineTotalPaise: item.unitPricePaise * item.quantity,
    });
  }
}

/** Minimal fixture catalog for Store A / Store B (upsert by handle/SKU). */
export async function seedFixtureCatalog(
  db: Database,
  storeId: string,
  storeSlug: string,
): Promise<void> {
  const categoryId = await ensureCategory(db, storeId, "Apparel", "apparel", null);
  await ensureCollection(db, storeId, "Featured", "featured", "Featured products");
  const productId = await ensureProduct(db, storeId, categoryId, {
    title: `${storeSlug} Classic Tee`,
    handle: "classic-tee",
    shortDescription: "Cotton tee priced in paise.",
    description: "A sample product priced in paise.",
  });
  await ensureVariantWithInventory(db, storeId, productId, {
    sku: `${storeSlug.toUpperCase()}-TEE-S`,
    title: "Small",
    pricePaise: 129_900,
    compareAtPricePaise: 149_900,
    availableQuantity: 100,
  });
}

export async function seedFixtureStore(
  db: Database,
  store: FixtureStoreSeed,
  storePasswordHash: string,
): Promise<SeededStoreSummary> {
  const { id: storeId, slug } = await upsertStore(db, store.name, store.slug);
  const adminEmail = await upsertStoreAdmin(db, store.adminEmail, storePasswordHash, storeId);
  await ensureStoreSettings(db, storeId, {
    currency: "INR",
    timezone: "Asia/Kolkata",
    shipping: { mode: "flat", flatPaise: 20_000, freeOverPaise: null },
    tax: { gstPercent: 3, gstin: null },
  });
  await seedFixtureCatalog(db, storeId, slug);
  const publishableKey = await ensureApiKey(db, storeId, "PUBLISHABLE");
  const secretKey = await ensureApiKey(db, storeId, "SECRET");
  return { id: storeId, slug, adminEmail, publishableKey, secretKey };
}

export async function seedDemoStore(
  db: Database,
  store: DemoStoreSeed,
  storePasswordHash: string,
): Promise<SeededStoreSummary> {
  const { id: storeId, slug } = await upsertStore(db, store.name, store.slug);
  const adminEmail = await upsertStoreAdmin(db, store.adminEmail, storePasswordHash, storeId);
  await ensureStoreSettings(db, storeId, store.settings);

  const categoryIds = new Map<string, string>();
  const parents = store.categories.filter((c) => !c.parentSlug);
  const children = store.categories.filter((c) => c.parentSlug);
  for (const cat of parents) {
    categoryIds.set(cat.slug, await ensureCategory(db, storeId, cat.name, cat.slug, null));
  }
  for (const cat of children) {
    const parentId = categoryIds.get(cat.parentSlug!) ?? null;
    categoryIds.set(cat.slug, await ensureCategory(db, storeId, cat.name, cat.slug, parentId));
  }

  const collectionIds = new Map<string, string>();
  for (const col of store.collections) {
    collectionIds.set(
      col.slug,
      await ensureCollection(db, storeId, col.name, col.slug, col.description),
    );
  }

  const productByHandle = new Map<string, { id: string; title: string }>();
  const variantBySku = new Map<
    string,
    { id: string; pricePaise: number; title: string; sku: string; productId: string; productTitle: string }
  >();

  for (const product of store.products) {
    const categoryId = categoryIds.get(product.categorySlug) ?? null;
    const productId = await ensureProduct(db, storeId, categoryId, product);
    productByHandle.set(product.handle, { id: productId, title: product.title });
    await ensureProductImage(db, storeId, productId, product.handle);

    for (const colSlug of product.collectionSlugs) {
      const collectionId = collectionIds.get(colSlug);
      if (collectionId) {
        await ensureCollectionProduct(db, storeId, collectionId, productId);
      }
    }

    for (const variant of product.variants) {
      const ensured = await ensureVariantWithInventory(db, storeId, productId, variant);
      variantBySku.set(variant.sku, {
        ...ensured,
        productId,
        productTitle: product.title,
      });
    }
  }

  const customerIds = new Map<string, string>();
  for (const customer of store.customers) {
    const id = await ensureCustomer(db, storeId, customer);
    customerIds.set(normalizeEmail(customer.email), id);
  }

  for (const discount of store.discounts) {
    await ensureDiscount(db, storeId, discount);
  }

  const cartCustomer = store.customers.find(
    (c) => normalizeEmail(c.email) === normalizeEmail(store.cart.customerEmail),
  );
  if (cartCustomer) {
    const cartCustomerId = customerIds.get(normalizeEmail(cartCustomer.email))!;
    const cartLines = store.cart.items
      .map((item) => {
        const variant = variantBySku.get(item.sku);
        if (!variant) return null;
        return {
          variantId: variant.id,
          quantity: item.quantity,
          unitPricePaise: variant.pricePaise,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
    if (cartLines.length > 0) {
      await ensureCart(
        db,
        storeId,
        cartCustomerId,
        cartCustomer.email,
        cartCustomer.address,
        cartLines,
      );
    }
  }

  for (const orderDef of store.orders) {
    const customer = store.customers.find(
      (c) => normalizeEmail(c.email) === normalizeEmail(orderDef.customerEmail),
    );
    if (!customer) continue;
    const customerId = customerIds.get(normalizeEmail(customer.email))!;
    const resolvedItems = orderDef.items
      .map((item) => {
        const variant = variantBySku.get(item.sku);
        const product = productByHandle.get(item.productHandle);
        if (!variant || !product) return null;
        return {
          productId: product.id,
          variantId: variant.id,
          productTitle: product.title,
          variantTitle: variant.title,
          sku: variant.sku,
          unitPricePaise: variant.pricePaise,
          quantity: item.quantity,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
    if (resolvedItems.length === 0) continue;
    await ensureOrder(
      db,
      storeId,
      orderDef,
      customerId,
      customer,
      resolvedItems,
      store.settings,
    );
  }

  const publishableKey = await ensureApiKey(db, storeId, "PUBLISHABLE");
  const secretKey = await ensureApiKey(db, storeId, "SECRET");

  return { id: storeId, slug, adminEmail, publishableKey, secretKey };
}
