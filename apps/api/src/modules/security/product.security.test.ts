import { config } from "dotenv";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "@/app";
import { closeDb, createDb, type DatabaseHandle } from "@/db/client";
import { stores } from "@/db/schema/stores";
import { products } from "@/db/schema/products";
import { productVariants } from "@/db/schema/product-variants";
import { inventory } from "@/db/schema/inventory";
import { carts } from "@/db/schema/carts";
import { auditLogs } from "@/db/schema/audit-logs";
import { DEVELOPMENT_STORES } from "@/db/seed";
import { StoreService } from "@/modules/store/store.service";
import { ProductService } from "@/modules/product/product.service";
import { resetRateLimitBuckets } from "@/middleware/rate-limit";
import { AUDIT_ACTIONS } from "@/modules/audit";

config({ path: ".env" });

const hasDb = Boolean(process.env.DATABASE_URL);
const jwtSecret =
  process.env.JWT_SECRET || "test-secret-at-least-32-characters-long";

type Json = Record<string, unknown>;

describe.runIf(hasDb)("HTTP security / tenant isolation", () => {
  let handle: DatabaseHandle;
  let storeAId: string;
  let storeBId: string;
  let productBId: string;
  let variantBId: string;
  let publishableA: string;
  let publishableB: string;
  let secretA: string;
  let storeAdminTokenA: string;
  let platformToken: string;

  const env = {
    DATABASE_URL: process.env.DATABASE_URL!,
    JWT_SECRET: jwtSecret,
    ENVIRONMENT: "development",
  };

  async function request(
    path: string,
    init: RequestInit = {},
  ): Promise<{ status: number; body: Json; headers: Headers }> {
    const app = createApp();
    const res = await app.request(
      path.startsWith("http") ? path : `http://localhost${path}`,
      init,
      env,
    );
    const text = await res.text();
    let body: Json = {};
    try {
      body = text ? (JSON.parse(text) as Json) : {};
    } catch {
      body = { raw: text };
    }
    return { status: res.status, body, headers: res.headers };
  }

  async function login(email: string, password: string) {
    const res = await request("/api/v1/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": `login-${email}`,
      },
      body: JSON.stringify({ email, password }),
    });
    expect(res.status).toBe(200);
    const data = res.body.data as { accessToken: string };
    return data.accessToken;
  }

  beforeAll(async () => {
    handle = createDb(process.env.DATABASE_URL!);
    const [alora, zentrix] = DEVELOPMENT_STORES;
    const storeA = await handle.db.query.stores.findFirst({ where: eq(stores.slug, alora!.slug) });
    const storeB = await handle.db.query.stores.findFirst({ where: eq(stores.slug, zentrix!.slug) });
    if (!storeA || !storeB) {
      throw new Error("Seed Alora Fashion / Zentrix before running security tests.");
    }
    storeAId = storeA.id;
    storeBId = storeB.id;

    const storeService = new StoreService(handle.db);
    const keyAPub = await storeService.createKey(storeAId, "PUBLISHABLE");
    const keyBPub = await storeService.createKey(storeBId, "PUBLISHABLE");
    const keyASec = await storeService.createKey(storeAId, "SECRET");
    publishableA = keyAPub.rawKey;
    publishableB = keyBPub.rawKey;
    secretA = keyASec.rawKey;

    const productB = await new ProductService(handle.db).create(storeBId, {
      title: `Sec B ${Date.now()}`,
      handle: `sec-b-${Date.now()}`,
      status: "ACTIVE",
    });
    productBId = productB.id;
    const [variant] = await handle.db
      .insert(productVariants)
      .values({
        storeId: storeBId,
        productId: productBId,
        sku: `SEC-B-${Date.now()}`,
        title: "Default",
        pricePaise: 1000,
        status: "ACTIVE",
      })
      .returning();
    variantBId = variant!.id;
    await handle.db.insert(inventory).values({
      storeId: storeBId,
      variantId: variantBId,
      availableQuantity: 5,
      reservedQuantity: 0,
    });

    storeAdminTokenA = await login(
      alora!.adminEmail,
      process.env.SEED_STORE_PASSWORD || "Admin@123",
    );
    platformToken = await login(
      process.env.SEED_PLATFORM_ADMIN_EMAIL || "platform@admin.com",
      process.env.SEED_PLATFORM_ADMIN_PASSWORD || "Platform@123",
    );
  });

  beforeEach(() => {
    resetRateLimitBuckets();
  });

  afterAll(async () => {
    if (variantBId) {
      await handle.db.delete(inventory).where(eq(inventory.variantId, variantBId));
      await handle.db.delete(productVariants).where(eq(productVariants.id, variantBId));
    }
    if (productBId) {
      await handle.db.delete(products).where(eq(products.id, productBId));
    }
    await closeDb(handle);
  });

  it("rejects store admin accessing platform routes", async () => {
    const res = await request("/api/v1/platform/metrics", {
      headers: { Authorization: `Bearer ${storeAdminTokenA}` },
    });
    expect(res.status).toBe(403);
  });

  it("lets platform admin create update and delete store products via store-scoped routes", async () => {
    const stamp = Date.now();
    const createdA = await request(`/api/v1/platform/stores/${storeAId}/products`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${platformToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: `Platform A ${stamp}`,
        handle: `platform-a-${stamp}`,
        status: "DRAFT",
      }),
    });
    expect(createdA.status).toBe(201);
    const productAId = (createdA.body.data as { id: string; storeId: string }).id;
    expect((createdA.body.data as { storeId: string }).storeId).toBe(storeAId);

    const createdB = await request(`/api/v1/platform/stores/${storeBId}/products`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${platformToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: `Platform B ${stamp}`,
        handle: `platform-b-${stamp}`,
        status: "DRAFT",
      }),
    });
    expect(createdB.status).toBe(201);
    const productBCreatedId = (createdB.body.data as { id: string }).id;

    const updated = await request(
      `/api/v1/platform/stores/${storeAId}/products/${productAId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${platformToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: `Platform A edited ${stamp}` }),
      },
    );
    expect(updated.status).toBe(200);
    expect((updated.body.data as { title: string }).title).toBe(`Platform A edited ${stamp}`);

    const deletedA = await request(
      `/api/v1/platform/stores/${storeAId}/products/${productAId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${platformToken}` },
      },
    );
    expect(deletedA.status).toBe(200);
    const deletedB = await request(
      `/api/v1/platform/stores/${storeBId}/products/${productBCreatedId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${platformToken}` },
      },
    );
    expect(deletedB.status).toBe(200);
  });

  it("rejects platform admin writing store products through admin routes", async () => {
    const res = await request("/api/v1/admin/products", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${platformToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Should fail",
        handle: `platform-admin-blocked-${Date.now()}`,
      }),
    });
    expect(res.status).toBe(403);
    expect(res.body.status).toBe("error");
  });

  it("rejects unknown or invalid platform store product targets", async () => {
    const invalid = await request("/api/v1/platform/stores/not-a-uuid/products", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${platformToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Invalid store",
        handle: `invalid-store-${Date.now()}`,
      }),
    });
    expect([400, 422]).toContain(invalid.status);

    const missing = await request(
      "/api/v1/platform/stores/00000000-0000-4000-8000-000000000000/products",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${platformToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Missing store",
          handle: `missing-store-${Date.now()}`,
        }),
      },
    );
    expect(missing.status).toBe(404);
    expect(missing.body.status).toBe("error");
  });

  it("rejects Store A admin reading Store B product by id", async () => {
    const res = await request(`/api/v1/admin/products/${productBId}`, {
      headers: { Authorization: `Bearer ${storeAdminTokenA}` },
    });
    expect([403, 404]).toContain(res.status);
    expect(res.body.status).toBe("error");
  });

  it("rejects Store A cart adding Store B variant", async () => {
    const createCart = await request("/api/v1/store/carts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-key": publishableA,
      },
      body: "{}",
    });
    expect(createCart.status).toBe(201);
    const cartId = (createCart.body.data as { id: string }).id;

    const add = await request(`/api/v1/store/carts/${cartId}/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-key": publishableA,
      },
      body: JSON.stringify({ variantId: variantBId, quantity: 1 }),
    });
    expect(add.status).toBeGreaterThanOrEqual(400);
    expect(add.body.status).toBe("error");

    await handle.db.delete(carts).where(eq(carts.id, cartId));
  });

  it("rejects Store A customer wishlisting Store B variant", async () => {
    const email = `wish-${Date.now()}@example.com`;
    const register = await request("/api/v1/store/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-key": publishableA,
      },
      body: JSON.stringify({
        email,
        password: "Customer@123",
        name: "Wishlist Tester",
      }),
    });
    expect(register.status).toBe(201);
    const token = (register.body.data as { accessToken: string }).accessToken;

    const add = await request("/api/v1/store/wishlist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-key": publishableA,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ variantId: variantBId }),
    });
    expect(add.status).toBeGreaterThanOrEqual(400);
    expect(add.body.status).toBe("error");
  });

  it("publishable key of Store A cannot list Store B catalog exclusively", async () => {
    const resA = await request("/api/v1/store/products", {
      headers: { "x-publishable-key": publishableA },
    });
    const resB = await request("/api/v1/store/products", {
      headers: { "x-publishable-key": publishableB },
    });
    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    const itemsA = resA.body.data as Array<{ id: string; handle?: string }>;
    expect(itemsA.some((p) => p.id === productBId)).toBe(false);
  });

  it("rejects deleted publishable keys", async () => {
    const created = await new StoreService(handle.db).createKey(storeAId, "PUBLISHABLE");
    await new StoreService(handle.db).deleteKey(storeAId, created.id);
    const res = await request("/api/v1/store/details", {
      headers: { "x-publishable-key": created.rawKey },
    });
    expect(res.status).toBe(401);
  });

  it("accepts secret key on s2s details and rejects publishable key there", async () => {
    const ok = await request("/api/v1/s2s/details", {
      headers: { Authorization: `Bearer ${secretA}` },
    });
    expect(ok.status).toBe(200);
    expect((ok.body.data as { accessType?: string }).accessType).toBe("SECRET_KEY");

    const bad = await request("/api/v1/s2s/details", {
      headers: { Authorization: `Bearer ${publishableA}` },
    });
    expect(bad.status).toBe(401);
  });

  it("writes audit log on API key create", async () => {
    const before = await handle.db.select().from(auditLogs);
    const create = await request("/api/v1/admin/keys", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${storeAdminTokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "PUBLISHABLE" }),
    });
    expect(create.status).toBe(201);
    const keyId = (create.body.data as { id: string }).id;
    const rows = await handle.db.query.auditLogs.findMany({
      where: and(
        eq(auditLogs.storeId, storeAId),
        eq(auditLogs.action, AUDIT_ACTIONS.API_KEY_CREATE),
        eq(auditLogs.resourceId, keyId),
      ),
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(before.length).toBeLessThan(
      (await handle.db.select().from(auditLogs)).length,
    );

    await new StoreService(handle.db).deleteKey(storeAId, keyId);
  });

  it("rate-limits auth login", async () => {
    resetRateLimitBuckets();
    const ip = `rl-${Date.now()}`;
    let saw429 = false;
    for (let i = 0; i < 25; i++) {
      const res = await request("/api/v1/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": ip,
        },
        body: JSON.stringify({ email: "nobody@example.com", password: "bad-password" }),
      });
      if (res.status === 429) {
        saw429 = true;
        break;
      }
    }
    expect(saw429).toBe(true);
  });

  it("sets secure headers on authenticated responses", async () => {
    const res = await request("/api/v1/platform/metrics", {
      headers: { Authorization: `Bearer ${platformToken}` },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
  });
});
