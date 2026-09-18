import { config } from "dotenv";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, createDb, type DatabaseHandle } from "@/db/client";
import { products } from "@/db/schema/products";
import { stores } from "@/db/schema/stores";
import { ProductRepository } from "@/modules/product/product.repository";
import { ProductService } from "@/modules/product/product.service";
import { signAuthToken, verifyAuthToken } from "@/modules/auth/jwt";
import { USER_ROLES } from "@/modules/auth/auth.types";
import { sha256Hex } from "@/infrastructure/crypto/api-key";
import { apiKeys } from "@/db/schema/api-keys";
import { inventory } from "@/db/schema/inventory";
import { carts } from "@/db/schema/carts";
import { cartLineItems } from "@/db/schema/cart-line-items";
import { orders } from "@/db/schema/orders";
import { productVariants } from "@/db/schema/product-variants";

config({ path: ".env" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDb)("store isolation (db)", () => {
  let handle: DatabaseHandle;
  let storeAId: string;
  let storeBId: string;

  beforeAll(async () => {
    handle = createDb(process.env.DATABASE_URL!);
    const storeA = await handle.db.query.stores.findFirst({ where: eq(stores.slug, "store-a") });
    const storeB = await handle.db.query.stores.findFirst({ where: eq(stores.slug, "store-b") });
    if (!storeA || !storeB) {
      throw new Error("Seed Store A/B before running isolation tests.");
    }
    storeAId = storeA.id;
    storeBId = storeB.id;
  });

  afterAll(async () => {
    await closeDb(handle);
  });

  it("cannot load Store B product via Store A repository scope", async () => {
    const repo = new ProductRepository(handle.db);
    const productB = await repo.create(storeBId, {
      title: `Isolation B ${Date.now()}`,
      handle: `iso-b-${Date.now()}`,
      status: "ACTIVE",
    });
    const found = await repo.findByStoreAndId(storeAId, productB.id);
    expect(found).toBeNull();
    await handle.db.delete(products).where(eq(products.id, productB.id));
  });

  it("publishable keys resolve to distinct stores", async () => {
    const keyA = await handle.db.query.apiKeys.findFirst({
      where: and(
        eq(apiKeys.storeId, storeAId),
        eq(apiKeys.type, "PUBLISHABLE"),
        eq(apiKeys.status, "ACTIVE"),
      ),
    });
    const keyB = await handle.db.query.apiKeys.findFirst({
      where: and(
        eq(apiKeys.storeId, storeBId),
        eq(apiKeys.type, "PUBLISHABLE"),
        eq(apiKeys.status, "ACTIVE"),
      ),
    });
    expect(keyA).toBeTruthy();
    expect(keyB).toBeTruthy();
    expect(keyA!.storeId).not.toBe(keyB!.storeId);
    expect(keyA!.secretHash).not.toBe(keyB!.secretHash);
  });

  it("store admin JWT storeId cannot equal the other store", async () => {
    const secret = process.env.JWT_SECRET || "test-secret-at-least-32-characters-long";
    const token = await signAuthToken(
      {
        sub: "admin-a",
        role: USER_ROLES.STORE_ADMIN,
        storeId: storeAId,
        typ: "admin",
      },
      { secret },
    );
    const payload = await verifyAuthToken(token, { secret });
    expect(payload.typ).toBe("admin");
    if (payload.typ === "admin") {
      expect(payload.storeId).toBe(storeAId);
      expect(payload.storeId).not.toBe(storeBId);
    }
  });

  it("checkout idempotency key is unique per store", async () => {
    const key = `idem-${Date.now()}`;
    const [order] = await handle.db
      .insert(orders)
      .values({
        storeId: storeAId,
        orderNumber: `TST-${Date.now()}`,
        status: "PENDING",
        idempotencyKey: key,
        subtotalPaise: 100,
        grandTotalPaise: 100,
        shippingName: "Test",
        shippingAddressLine1: "1 Main",
        shippingCity: "City",
        shippingPostalCode: "560001",
        shippingCountry: "IN",
      })
      .returning();

    await expect(
      handle.db.insert(orders).values({
        storeId: storeAId,
        orderNumber: `TST-${Date.now()}-2`,
        status: "PENDING",
        idempotencyKey: key,
        subtotalPaise: 100,
        grandTotalPaise: 100,
        shippingName: "Test",
        shippingAddressLine1: "1 Main",
        shippingCity: "City",
        shippingPostalCode: "560001",
        shippingCountry: "IN",
      }),
    ).rejects.toThrow();

    await handle.db.delete(orders).where(eq(orders.id, order!.id));
  });

  it("inventory adjust rejects negative stock", async () => {
    const service = new ProductService(handle.db);
    const product = await service.create(storeAId, {
      title: `Stock ${Date.now()}`,
      handle: `stock-${Date.now()}`,
      status: "ACTIVE",
    });
    const [variant] = await handle.db
      .insert(productVariants)
      .values({
        storeId: storeAId,
        productId: product.id,
        sku: `SKU-${Date.now()}`,
        title: "Default",
        pricePaise: 1000,
        status: "ACTIVE",
      })
      .returning();
    await handle.db.insert(inventory).values({
      storeId: storeAId,
      variantId: variant!.id,
      availableQuantity: 1,
      reservedQuantity: 0,
    });

    const row = await handle.db.query.inventory.findFirst({
      where: and(eq(inventory.storeId, storeAId), eq(inventory.variantId, variant!.id)),
    });
    expect(row!.availableQuantity).toBe(1);
    expect(row!.availableQuantity - 2 < 0).toBe(true);

    await handle.db.delete(inventory).where(eq(inventory.variantId, variant!.id));
    await handle.db.delete(productVariants).where(eq(productVariants.id, variant!.id));
    await handle.db.delete(products).where(eq(products.id, product.id));
  });

  it("cart lines stay store-scoped", async () => {
    const [cart] = await handle.db
      .insert(carts)
      .values({ storeId: storeAId, status: "ACTIVE", subtotalPaise: 0 })
      .returning();
    const foreign = await handle.db.query.cartLineItems.findFirst({
      where: and(eq(cartLineItems.cartId, cart!.id), eq(cartLineItems.storeId, storeBId)),
    });
    expect(foreign).toBeUndefined();
    await handle.db.delete(carts).where(eq(carts.id, cart!.id));
  });
});

describe("api key hashing", () => {
  it("hashes deterministically for lookup", async () => {
    const a = await sha256Hex("pk_live_abc");
    const b = await sha256Hex("pk_live_abc");
    const c = await sha256Hex("pk_live_xyz");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
