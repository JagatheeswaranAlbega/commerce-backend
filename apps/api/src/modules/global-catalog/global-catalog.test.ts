import { config } from "dotenv";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, createDb, type DatabaseHandle } from "@/db/client";
import { DEVELOPMENT_STORES } from "@/db/seed";
import { categories } from "@/db/schema/categories";
import { globalProducts } from "@/db/schema/global-products";
import { globalProductVariants } from "@/db/schema/global-product-variants";
import { inventory } from "@/db/schema/inventory";
import { products } from "@/db/schema/products";
import { storeGlobalProducts } from "@/db/schema/store-global-products";
import { stores } from "@/db/schema/stores";
import { GlobalCatalogService } from "@/modules/global-catalog/global-catalog.service";
import { findSellableVariant } from "@/modules/global-catalog/sellable-variant";
import { ProductService } from "@/modules/product/product.service";
import {
  ConflictError,
  DuplicateResourceError,
  NotFoundError,
} from "@/shared/errors/app-error";

config({ path: ".env" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDb)("global catalog", () => {
  let handle: DatabaseHandle;
  let storeAId: string;
  let storeBId: string;
  let storeACategoryId: string;
  let storeBCategoryId: string;
  let globalProductId: string;
  let globalVariantId: string;
  let globalHandle: string;
  const createdStoreCategoryIds: string[] = [];
  const createdGlobalProductIds: string[] = [];

  beforeAll(async () => {
    handle = createDb(process.env.DATABASE_URL!);
    const [alora, zentrix] = DEVELOPMENT_STORES;
    const storeA = await handle.db.query.stores.findFirst({ where: eq(stores.slug, alora!.slug) });
    const storeB = await handle.db.query.stores.findFirst({ where: eq(stores.slug, zentrix!.slug) });
    if (!storeA || !storeB) {
      throw new Error("Seed stores before running global catalog tests.");
    }
    storeAId = storeA.id;
    storeBId = storeB.id;

    const existingA = await handle.db.query.categories.findFirst({
      where: eq(categories.storeId, storeAId),
    });
    if (existingA) {
      storeACategoryId = existingA.id;
    } else {
      const [created] = await handle.db
        .insert(categories)
        .values({ storeId: storeAId, name: "Alora Test", slug: `alora-test-${Date.now()}` })
        .returning({ id: categories.id });
      storeACategoryId = created!.id;
      createdStoreCategoryIds.push(storeACategoryId);
    }

    const existingB = await handle.db.query.categories.findFirst({
      where: eq(categories.storeId, storeBId),
    });
    if (existingB) {
      storeBCategoryId = existingB.id;
    } else {
      const [created] = await handle.db
        .insert(categories)
        .values({ storeId: storeBId, name: "Zentrix Test", slug: `zentrix-test-${Date.now()}` })
        .returning({ id: categories.id });
      storeBCategoryId = created!.id;
      createdStoreCategoryIds.push(storeBCategoryId);
    }

    const service = new GlobalCatalogService(handle.db);
    const stamp = Date.now();
    globalHandle = `global-test-${stamp}`;
    const category = await service.createCategory({
      name: `Global Test ${stamp}`,
      slug: `global-test-${stamp}`,
    });
    const product = await service.createProduct({
      title: `Global Test Product ${stamp}`,
      handle: globalHandle,
      status: "ACTIVE",
      categoryId: category.id,
    });
    const variant = await service.createVariant(product.id, {
      sku: `GLOBAL-TEST-${stamp}`,
      title: "Default",
      pricePaise: 99900,
      status: "ACTIVE",
    });
    globalProductId = product.id;
    globalVariantId = variant.id;
  });

  afterAll(async () => {
    const productIds = [globalProductId, ...createdGlobalProductIds].filter(Boolean);
    for (const productId of productIds) {
      await handle.db
        .delete(storeGlobalProducts)
        .where(eq(storeGlobalProducts.globalProductId, productId));
      await handle.db.delete(globalProducts).where(eq(globalProducts.id, productId));
    }
    for (const categoryId of createdStoreCategoryIds) {
      await handle.db.delete(categories).where(eq(categories.id, categoryId));
    }
    await closeDb(handle);
  });

  it("imports into a store once and seeds inventory", async () => {
    const service = new GlobalCatalogService(handle.db);
    const imported = await service.importToStore(storeAId, globalProductId, {
      storeCategoryId: storeACategoryId,
    });
    expect(imported.imported).toBe(true);
    expect(imported.storeCategoryId).toBe(storeACategoryId);

    const stock = await handle.db.query.inventory.findFirst({
      where: eq(inventory.variantId, globalVariantId),
    });
    expect(stock?.storeId).toBe(storeAId);
    expect(stock?.source).toBe("GLOBAL");
    expect(stock?.availableQuantity).toBe(0);

    await expect(
      service.importToStore(storeAId, globalProductId, { storeCategoryId: storeACategoryId }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("blocks import when a local handle collides", async () => {
    const service = new GlobalCatalogService(handle.db);
    const stamp = Date.now();
    const product = await service.createProduct({
      title: `Collision ${stamp}`,
      handle: `collision-${stamp}`,
      status: "ACTIVE",
    });
    await service.createVariant(product.id, {
      sku: `COLLIDE-${stamp}`,
      title: "Default",
      pricePaise: 100,
      status: "ACTIVE",
    });
    await handle.db.insert(products).values({
      storeId: storeBId,
      title: "Local collision",
      handle: `collision-${stamp}`,
      status: "ACTIVE",
    });

    await expect(
      service.importToStore(storeBId, product.id, { storeCategoryId: storeBCategoryId }),
    ).rejects.toBeInstanceOf(ConflictError);

    await handle.db.delete(globalProducts).where(eq(globalProducts.id, product.id));
    await handle.db.delete(products).where(eq(products.handle, `collision-${stamp}`));
  });

  it("exposes imported products in catalog and sellable resolver", async () => {
    const service = new GlobalCatalogService(handle.db);
    // Ensure imported for store A (may already be from previous test)
    const existing = await handle.db.query.storeGlobalProducts.findFirst({
      where: eq(storeGlobalProducts.globalProductId, globalProductId),
    });
    if (!existing) {
      await service.importToStore(storeAId, globalProductId, {
        storeCategoryId: storeACategoryId,
      });
    }

    await handle.db
      .update(inventory)
      .set({ availableQuantity: 5 })
      .where(eq(inventory.variantId, globalVariantId));

    const catalog = await new ProductService(handle.db).getCatalogByHandle(
      storeAId,
      globalHandle,
    );
    expect(catalog.source).toBe("GLOBAL");
    expect(catalog.id).toBe(globalProductId);

    const sellable = await findSellableVariant(handle.db, storeAId, globalVariantId);
    expect(sellable?.source).toBe("GLOBAL");
    expect(sellable?.pricePaise).toBe(99900);

    const notInB = await findSellableVariant(handle.db, storeBId, globalVariantId);
    expect(notInB).toBeNull();
  });

  it("removes store association without deleting the global product", async () => {
    const service = new GlobalCatalogService(handle.db);
    await service.removeFromStore(storeAId, globalProductId);

    const association = await handle.db.query.storeGlobalProducts.findFirst({
      where: eq(storeGlobalProducts.globalProductId, globalProductId),
    });
    expect(association).toBeUndefined();

    const master = await handle.db.query.globalProducts.findFirst({
      where: eq(globalProducts.id, globalProductId),
    });
    expect(master).toBeTruthy();

    const variants = await handle.db.query.globalProductVariants.findMany({
      where: eq(globalProductVariants.productId, globalProductId),
    });
    expect(variants.length).toBeGreaterThan(0);

    // Re-import allowed after remove
    await service.importToStore(storeAId, globalProductId, {
      storeCategoryId: storeACategoryId,
    });
  });

  it("maps an imported product onto a store category and catalog filter", async () => {
    const service = new GlobalCatalogService(handle.db);
    const stamp = Date.now();
    const product = await service.createProduct({
      title: `Mapped Perfume ${stamp}`,
      handle: `mapped-perfume-${stamp}`,
      status: "ACTIVE",
    });
    createdGlobalProductIds.push(product.id);
    await service.createVariant(product.id, {
      sku: `MAPPED-${stamp}`,
      title: "Default",
      pricePaise: 250000,
      status: "ACTIVE",
    });

    const imported = await service.importToStore(storeAId, product.id, {
      storeCategoryId: storeACategoryId,
    });
    expect(imported.storeCategoryId).toBe(storeACategoryId);

    const association = await handle.db.query.storeGlobalProducts.findFirst({
      where: and(
        eq(storeGlobalProducts.storeId, storeAId),
        eq(storeGlobalProducts.globalProductId, product.id),
      ),
    });
    expect(association?.storeCategoryId).toBe(storeACategoryId);

    const catalog = await new ProductService(handle.db).listCatalog(storeAId, {
      page: 1,
      pageSize: 50,
      categoryId: storeACategoryId,
    });
    expect(catalog.items.some((item) => item.id === product.id)).toBe(true);
    const listed = catalog.items.find((item) => item.id === product.id);
    expect(listed?.categoryId).toBe(storeACategoryId);
  });

  it("creates a store category during import", async () => {
    const service = new GlobalCatalogService(handle.db);
    const stamp = Date.now();
    const slug = `perfumes-${stamp}`;
    const product = await service.createProduct({
      title: `Created Cat Perfume ${stamp}`,
      handle: `created-cat-perfume-${stamp}`,
      status: "ACTIVE",
    });
    createdGlobalProductIds.push(product.id);
    await service.createVariant(product.id, {
      sku: `CREATED-CAT-${stamp}`,
      title: "Default",
      pricePaise: 180000,
      status: "ACTIVE",
    });

    const imported = await service.importToStore(storeAId, product.id, {
      newCategory: { name: "Perfumes", slug },
    });
    expect(imported.storeCategoryId).toBeTruthy();

    const created = await handle.db.query.categories.findFirst({
      where: and(eq(categories.storeId, storeAId), eq(categories.slug, slug)),
    });
    expect(created?.name).toBe("Perfumes");
    expect(imported.storeCategoryId).toBe(created?.id);
    if (created) createdStoreCategoryIds.push(created.id);
  });

  it("rejects a category that belongs to another store", async () => {
    const service = new GlobalCatalogService(handle.db);
    const stamp = Date.now();
    const product = await service.createProduct({
      title: `Cross Tenant ${stamp}`,
      handle: `cross-tenant-${stamp}`,
      status: "ACTIVE",
    });
    createdGlobalProductIds.push(product.id);
    await service.createVariant(product.id, {
      sku: `CROSS-${stamp}`,
      title: "Default",
      pricePaise: 100,
      status: "ACTIVE",
    });

    await expect(
      service.importToStore(storeAId, product.id, { storeCategoryId: storeBCategoryId }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects creating a store category with a duplicate slug", async () => {
    const service = new GlobalCatalogService(handle.db);
    const existing = await handle.db.query.categories.findFirst({
      where: eq(categories.id, storeACategoryId),
    });
    if (!existing) throw new Error("Store A category missing.");

    const stamp = Date.now();
    const product = await service.createProduct({
      title: `Dup Slug ${stamp}`,
      handle: `dup-slug-${stamp}`,
      status: "ACTIVE",
    });
    createdGlobalProductIds.push(product.id);
    await service.createVariant(product.id, {
      sku: `DUP-SLUG-${stamp}`,
      title: "Default",
      pricePaise: 100,
      status: "ACTIVE",
    });

    await expect(
      service.importToStore(storeAId, product.id, {
        newCategory: { name: "Copy", slug: existing.slug },
      }),
    ).rejects.toBeInstanceOf(DuplicateResourceError);
  });

  it("remaps an imported product to another store category", async () => {
    const service = new GlobalCatalogService(handle.db);
    const stamp = Date.now();
    const product = await service.createProduct({
      title: `Remap ${stamp}`,
      handle: `remap-${stamp}`,
      status: "ACTIVE",
    });
    createdGlobalProductIds.push(product.id);
    await service.createVariant(product.id, {
      sku: `REMAP-${stamp}`,
      title: "Default",
      pricePaise: 100,
      status: "ACTIVE",
    });

    await service.importToStore(storeAId, product.id, {
      storeCategoryId: storeACategoryId,
    });
    const remapped = await service.remapStoreCategory(storeAId, product.id, {
      newCategory: { name: "Remapped", slug: `remapped-${stamp}` },
    });
    expect(remapped.storeCategoryId).toBeTruthy();
    expect(remapped.storeCategoryId).not.toBe(storeACategoryId);

    const association = await handle.db.query.storeGlobalProducts.findFirst({
      where: and(
        eq(storeGlobalProducts.storeId, storeAId),
        eq(storeGlobalProducts.globalProductId, product.id),
      ),
    });
    expect(association?.storeCategoryId).toBe(remapped.storeCategoryId);
    if (remapped.storeCategoryId) createdStoreCategoryIds.push(remapped.storeCategoryId);

    const stillThere = await handle.db.query.inventory.findFirst({
      where: eq(inventory.storeId, storeAId),
    });
    expect(stillThere).toBeTruthy();
  });

  it("rejects duplicate global handles", async () => {
    const service = new GlobalCatalogService(handle.db);
    await expect(
      service.createProduct({
        title: "Dup",
        handle: globalHandle,
        status: "DRAFT",
      }),
    ).rejects.toBeInstanceOf(DuplicateResourceError);
  });

  it("lists child-category products when filtering by parent", async () => {
    const service = new GlobalCatalogService(handle.db);
    const stamp = Date.now();
    const parent = await service.createCategory({
      name: `Jewellery Parent ${stamp}`,
      slug: `jewellery-parent-${stamp}`,
    });
    const child = await service.createCategory({
      name: `Rings Child ${stamp}`,
      slug: `rings-child-${stamp}`,
      parentId: parent.id,
    });
    const product = await service.createProduct({
      title: `Parent Filter Ring ${stamp}`,
      handle: `parent-filter-ring-${stamp}`,
      status: "ACTIVE",
      categoryId: child.id,
    });
    createdGlobalProductIds.push(product.id);

    const listed = await service.listProducts({
      page: 1,
      pageSize: 50,
      categoryId: parent.id,
    });
    expect(listed.items.some((item) => item.id === product.id)).toBe(true);
  });
});
