import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, createDb, type DatabaseHandle } from "@/db/client";
import { DEVELOPMENT_STORES } from "@/db/seed";
import { globalProducts } from "@/db/schema/global-products";
import { globalProductVariants } from "@/db/schema/global-product-variants";
import { inventory } from "@/db/schema/inventory";
import { products } from "@/db/schema/products";
import { storeGlobalProducts } from "@/db/schema/store-global-products";
import { stores } from "@/db/schema/stores";
import { GlobalCatalogService } from "@/modules/global-catalog/global-catalog.service";
import { findSellableVariant } from "@/modules/global-catalog/sellable-variant";
import { ProductService } from "@/modules/product/product.service";
import { ConflictError, DuplicateResourceError } from "@/shared/errors/app-error";

config({ path: ".env" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDb)("global catalog", () => {
  let handle: DatabaseHandle;
  let storeAId: string;
  let storeBId: string;
  let globalProductId: string;
  let globalVariantId: string;
  let globalHandle: string;

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
    if (globalProductId) {
      await handle.db
        .delete(storeGlobalProducts)
        .where(eq(storeGlobalProducts.globalProductId, globalProductId));
      await handle.db.delete(globalProducts).where(eq(globalProducts.id, globalProductId));
    }
    await closeDb(handle);
  });

  it("imports into a store once and seeds inventory", async () => {
    const service = new GlobalCatalogService(handle.db);
    const imported = await service.importToStore(storeAId, globalProductId);
    expect(imported.imported).toBe(true);

    const stock = await handle.db.query.inventory.findFirst({
      where: eq(inventory.variantId, globalVariantId),
    });
    expect(stock?.storeId).toBe(storeAId);
    expect(stock?.source).toBe("GLOBAL");
    expect(stock?.availableQuantity).toBe(0);

    await expect(service.importToStore(storeAId, globalProductId)).rejects.toBeInstanceOf(
      ConflictError,
    );
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

    await expect(service.importToStore(storeBId, product.id)).rejects.toBeInstanceOf(
      ConflictError,
    );

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
      await service.importToStore(storeAId, globalProductId);
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
    await service.importToStore(storeAId, globalProductId);
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
});
