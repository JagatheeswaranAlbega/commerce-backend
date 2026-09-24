import type { Database } from "@/db/client";

export type DevelopmentStoreSeed = {
  name: string;
  slug: string;
  adminEmail: string;
  previousSlugs?: readonly string[];
  previousAdminEmails?: readonly string[];
};

export const DEVELOPMENT_STORES: readonly DevelopmentStoreSeed[] = [
  {
    name: "Alora Fashion",
    slug: "alora-fashion",
    adminEmail: "admin@alora.com",
    previousSlugs: ["store-a"],
    previousAdminEmails: ["admin@store-a.local"],
  },
  {
    name: "Zentrix",
    slug: "zentrix",
    adminEmail: "admin@zentrix.com",
    previousSlugs: ["store-b"],
    previousAdminEmails: ["admin@store-b.local"],
  },
];

export type SeedResult = {
  platformAdminEmail: string;
  stores: Array<{
    id: string;
    slug: string;
    adminEmail: string;
    publishableKey: string;
    secretKey: string;
  }>;
};

type SeedInput = {
  storePassword: string;
  platformAdminEmail?: string;
  platformAdminPassword?: string;
};

import { and, eq, inArray, isNull } from "drizzle-orm";
import { apiKeys } from "@/db/schema/api-keys";
import { categories } from "@/db/schema/categories";
import { collections } from "@/db/schema/collections";
import { inventory } from "@/db/schema/inventory";
import { platformSettings } from "@/db/schema/platform-settings";
import { productVariants } from "@/db/schema/product-variants";
import { products } from "@/db/schema/products";
import { storeSettings } from "@/db/schema/store-settings";
import { stores } from "@/db/schema/stores";
import { users } from "@/db/schema/users";
import { generateApiKey, sha256Hex } from "@/infrastructure/crypto/api-key";
import { hashPassword } from "@/infrastructure/crypto/password";
import { normalizeEmail, normalizeSlug } from "@/shared/tenant/normalize";
import {
  ALORA_WOMEN_CATEGORY,
  ALORA_WOMEN_PRODUCTS,
} from "@/db/seed-data/alora-women-catalog";
import {
  ZENTRIX_BABY_PRODUCTS,
  ZENTRIX_CATEGORIES,
  zentrixSku,
} from "@/db/seed-data/zentrix-baby-catalog";
import { globalCategories } from "@/db/schema/global-categories";
import { globalProductVariants } from "@/db/schema/global-product-variants";
import { globalProducts } from "@/db/schema/global-products";

async function seedGlobalCatalog(db: Database): Promise<void> {
  const existing = await db.query.globalCategories.findFirst();
  if (existing) return;

  const categorySeeds = [
    { name: "Fashion", slug: "fashion" },
    { name: "Electronics", slug: "electronics" },
    { name: "Beauty", slug: "beauty" },
  ] as const;

  const createdCategories: Record<string, string> = {};
  for (const category of categorySeeds) {
    const [row] = await db
      .insert(globalCategories)
      .values({
        name: category.name,
        slug: category.slug,
        status: "ACTIVE",
      })
      .returning({ id: globalCategories.id });
    createdCategories[category.slug] = row!.id;
  }

  const productSeeds = [
    {
      categorySlug: "fashion",
      title: "Everyday Cotton Tee",
      handle: "everyday-cotton-tee",
      shortDescription: "Soft unisex cotton tee for daily wear.",
      description: "A shared platform master product suitable for fashion stores.",
      sku: "GLOBAL-FASHION-TEE-01",
      pricePaise: 79900,
    },
    {
      categorySlug: "electronics",
      title: "Wireless Earbuds Pro",
      handle: "wireless-earbuds-pro",
      shortDescription: "Noise-isolating earbuds with USB-C case.",
      description: "Global electronics master SKU for multi-store import.",
      sku: "GLOBAL-ELEC-EARBUDS-01",
      pricePaise: 249900,
    },
    {
      categorySlug: "beauty",
      title: "Hydrating Face Serum",
      handle: "hydrating-face-serum",
      shortDescription: "Lightweight hyaluronic serum for all skin types.",
      description: "Beauty category master product for store import demos.",
      sku: "GLOBAL-BEAUTY-SERUM-01",
      pricePaise: 129900,
    },
  ] as const;

  for (const item of productSeeds) {
    const [product] = await db
      .insert(globalProducts)
      .values({
        categoryId: createdCategories[item.categorySlug]!,
        title: item.title,
        handle: item.handle,
        shortDescription: item.shortDescription,
        description: item.description,
        status: "ACTIVE",
      })
      .returning({ id: globalProducts.id });

    await db.insert(globalProductVariants).values({
      productId: product!.id,
      sku: item.sku,
      title: "Default",
      pricePaise: item.pricePaise,
      status: "ACTIVE",
    });
  }
}

async function upsertPlatformAdmin(
  db: Database,
  email: string,
  password: string,
): Promise<void> {
  const normalized = normalizeEmail(email);
  const passwordHash = await hashPassword(password);
  const existingByEmail = await db.query.users.findFirst({
    where: eq(users.email, normalized),
  });
  const existingPlatform =
    existingByEmail ??
    (await db.query.users.findFirst({
      where: and(eq(users.role, "PLATFORM_SUPER_ADMIN"), isNull(users.storeId)),
    }));
  if (existingPlatform) {
    await db
      .update(users)
      .set({
        email: normalized,
        passwordHash,
        role: "PLATFORM_SUPER_ADMIN",
        storeId: null,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingPlatform.id));
    return;
  }
  await db.insert(users).values({
    email: normalized,
    passwordHash,
    role: "PLATFORM_SUPER_ADMIN",
    storeId: null,
    isActive: true,
  });
}

async function ensureApiKey(
  db: Database,
  storeId: string,
  type: "PUBLISHABLE" | "SECRET",
): Promise<string> {
  const existing = await db.query.apiKeys.findFirst({
    where: (table, { and, eq: eqOp }) =>
      and(eqOp(table.storeId, storeId), eqOp(table.type, type), eqOp(table.status, "ACTIVE")),
  });
  if (existing) {
    // Preserve existing keys — raw value cannot be recovered after hash storage.
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

async function seedAloraWomenCatalog(db: Database, storeId: string) {
  const [category] = await db
    .insert(categories)
    .values({
      storeId,
      name: ALORA_WOMEN_CATEGORY.name,
      slug: ALORA_WOMEN_CATEGORY.slug,
      status: "ACTIVE",
    })
    .returning({ id: categories.id });

  await db.insert(collections).values({
    storeId,
    name: "Featured",
    slug: "featured",
    description: "Featured women's ethnic wear",
    status: "ACTIVE",
  });

  for (const item of ALORA_WOMEN_PRODUCTS) {
    const [product] = await db
      .insert(products)
      .values({
        storeId,
        categoryId: category!.id,
        title: item.title,
        handle: item.handle,
        shortDescription: item.shortDescription,
        description: item.description,
        status: "ACTIVE",
      })
      .returning({ id: products.id });

    const [variant] = await db
      .insert(productVariants)
      .values({
        storeId,
        productId: product!.id,
        sku: item.sku,
        title: item.variantTitle,
        pricePaise: item.pricePaise,
        compareAtPricePaise: item.compareAtPricePaise,
        status: "ACTIVE",
      })
      .returning({ id: productVariants.id });

    await db.insert(inventory).values({
      storeId,
      variantId: variant!.id,
      availableQuantity: item.initialQuantity,
      reservedQuantity: 0,
    });
  }
}

async function seedZentrixBabyCatalog(db: Database, storeId: string) {
  const categoryIds = new Map<string, string>();
  for (const cat of ZENTRIX_CATEGORIES) {
    const [row] = await db
      .insert(categories)
      .values({
        storeId,
        name: cat.name,
        slug: cat.slug,
        status: "ACTIVE",
      })
      .returning({ id: categories.id });
    categoryIds.set(cat.slug, row!.id);
  }

  const existingFeatured = await db.query.collections.findFirst({
    where: and(eq(collections.storeId, storeId), eq(collections.slug, "featured")),
  });
  if (!existingFeatured) {
    await db.insert(collections).values({
      storeId,
      name: "Featured",
      slug: "featured",
      description: "Featured baby fashion",
      status: "ACTIVE",
    });
  }

  for (const item of ZENTRIX_BABY_PRODUCTS) {
    const categoryId = categoryIds.get(item.categorySlug);
    if (!categoryId) {
      throw new Error(`Missing Zentrix category for slug ${item.categorySlug}`);
    }
    const [product] = await db
      .insert(products)
      .values({
        storeId,
        categoryId,
        title: item.title,
        handle: item.handle,
        shortDescription: item.shortDescription,
        description: item.description,
        status: "ACTIVE",
      })
      .returning({ id: products.id });

    for (const size of item.sizes) {
      const [variant] = await db
        .insert(productVariants)
        .values({
          storeId,
          productId: product!.id,
          sku: zentrixSku(item.skuBase, size),
          title: size,
          pricePaise: item.pricePaise,
          compareAtPricePaise: item.compareAtPricePaise,
          status: "ACTIVE",
        })
        .returning({ id: productVariants.id });

      await db.insert(inventory).values({
        storeId,
        variantId: variant!.id,
        availableQuantity: item.initialQuantityPerSize,
        reservedQuantity: 0,
      });
    }
  }
}

/** Older seed catalogs prefixed handles with 01-, 02-, … — strip those on existing rows. */
async function stripNumericHandlePrefixes(db: Database, storeId: string) {
  const rows = await db.query.products.findMany({
    where: eq(products.storeId, storeId),
    columns: { id: true, handle: true },
  });
  for (const row of rows) {
    const next = row.handle.replace(/^\d+-/, "");
    if (!next || next === row.handle) continue;
    await db
      .update(products)
      .set({ handle: next, updatedAt: new Date() })
      .where(and(eq(products.id, row.id), eq(products.storeId, storeId)));
  }
}

async function seedStoreCatalog(db: Database, storeId: string, storeSlug: string) {
  const existingProduct = await db.query.products.findFirst({
    where: eq(products.storeId, storeId),
  });
  if (existingProduct) {
    await stripNumericHandlePrefixes(db, storeId);
    return;
  }

  if (storeSlug === "alora-fashion") {
    await seedAloraWomenCatalog(db, storeId);
    return;
  }

  if (storeSlug === "zentrix") {
    await seedZentrixBabyCatalog(db, storeId);
    return;
  }
}

async function seedOneStore(
  db: Database,
  store: DevelopmentStoreSeed,
  storePasswordHash: string,
): Promise<{
  id: string;
  slug: string;
  adminEmail: string;
  publishableKey: string;
  secretKey: string;
}> {
  const slug = normalizeSlug(store.slug);
  const adminEmail = normalizeEmail(store.adminEmail);
  const slugCandidates = [
    slug,
    ...(store.previousSlugs ?? []).map((value) => normalizeSlug(value)),
  ];
  const emailCandidates = [
    adminEmail,
    ...(store.previousAdminEmails ?? []).map((value) => normalizeEmail(value)),
  ];

  let storeRow = await db.query.stores.findFirst({
    where: inArray(stores.slug, slugCandidates),
  });
  if (storeRow) {
    await db
      .update(stores)
      .set({ name: store.name, slug, status: "ACTIVE", updatedAt: new Date() })
      .where(eq(stores.id, storeRow.id));
    storeRow = { ...storeRow, name: store.name, slug };
  } else {
    const [created] = await db
      .insert(stores)
      .values({ name: store.name, slug, status: "ACTIVE" })
      .returning();
    storeRow = created!;
  }

  const existingAdmin =
    (await db.query.users.findFirst({
      where: inArray(users.email, emailCandidates),
    })) ??
    (await db.query.users.findFirst({
      where: and(eq(users.storeId, storeRow.id), eq(users.role, "STORE_ADMIN")),
    }));
  if (existingAdmin) {
    await db
      .update(users)
      .set({
        email: adminEmail,
        passwordHash: storePasswordHash,
        role: "STORE_ADMIN",
        storeId: storeRow.id,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingAdmin.id));
  } else {
    await db.insert(users).values({
      email: adminEmail,
      passwordHash: storePasswordHash,
      role: "STORE_ADMIN",
      storeId: storeRow.id,
      isActive: true,
    });
  }

  for (const setting of [
    { key: "currency", value: "INR" as const },
    { key: "timezone", value: "Asia/Kolkata" as const },
    {
      key: "shipping",
      value: { mode: "flat", flatPaise: 20_000, freeOverPaise: null },
    },
    {
      key: "tax",
      value: { gstPercent: 3, gstin: null },
    },
  ]) {
    const existingSetting = await db.query.storeSettings.findFirst({
      where: (table, { and, eq: eqOp }) =>
        and(eqOp(table.storeId, storeRow.id), eqOp(table.key, setting.key)),
    });
    if (!existingSetting) {
      await db.insert(storeSettings).values({
        storeId: storeRow.id,
        key: setting.key,
        value: setting.value,
      });
    }
  }

  await seedStoreCatalog(db, storeRow.id, slug);

  const publishableKey = await ensureApiKey(db, storeRow.id, "PUBLISHABLE");
  const secretKey = await ensureApiKey(db, storeRow.id, "SECRET");

  return {
    id: storeRow.id,
    slug,
    adminEmail,
    publishableKey,
    secretKey,
  };
}

export async function seedDevelopmentData(db: Database, input: SeedInput): Promise<SeedResult> {
  const platformAdminEmail = normalizeEmail(input.platformAdminEmail ?? "platform@admin.com");
  const platformAdminPassword = input.platformAdminPassword ?? "Platform@123";
  const storePasswordHash = await hashPassword(input.storePassword);

  await upsertPlatformAdmin(db, platformAdminEmail, platformAdminPassword);

  for (const setting of [
    { key: "platformName", value: "Commerce Console" as const },
    { key: "supportEmail", value: "support@local.dev" as const },
  ]) {
    const existing = await db.query.platformSettings.findFirst({
      where: eq(platformSettings.key, setting.key),
    });
    if (!existing) {
      await db.insert(platformSettings).values({
        key: setting.key,
        value: setting.value,
      });
    }
  }

  const seededStores = [];
  for (const store of DEVELOPMENT_STORES) {
    seededStores.push(await seedOneStore(db, store, storePasswordHash));
  }

  await seedGlobalCatalog(db);

  return {
    platformAdminEmail,
    stores: seededStores,
  };
}
