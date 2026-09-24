import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "@/app";
import { closeDb, createDb, type DatabaseHandle } from "@/db/client";
import { carts } from "@/db/schema/carts";
import { customers } from "@/db/schema/customers";
import { stores } from "@/db/schema/stores";
import { DEVELOPMENT_STORES } from "@/db/seed";
import { resetRateLimitBuckets } from "@/middleware/rate-limit";
import { StoreService } from "@/modules/store/store.service";
import { updateCustomerProfileSchema } from "./customer.schemas";

config({ path: ".env" });

const hasDb = Boolean(process.env.DATABASE_URL);
const jwtSecret = process.env.JWT_SECRET || "test-secret-at-least-32-characters-long";

type Json = Record<string, unknown>;

describe("customer profile schemas", () => {
  it("requires at least one profile field", () => {
    const parsed = updateCustomerProfileSchema.safeParse({});
    expect(parsed.success).toBe(false);
  });

  it("rejects a future date of birth", () => {
    const parsed = updateCustomerProfileSchema.safeParse({ dateOfBirth: "2999-01-01" });
    expect(parsed.success).toBe(false);
  });

  it("accepts a complete optional profile patch", () => {
    const parsed = updateCustomerProfileSchema.safeParse({
      name: "Ada",
      phone: "9999999999",
      dateOfBirth: "1994-05-20",
      gender: "FEMALE",
    });
    expect(parsed.success).toBe(true);
  });
});

describe.runIf(hasDb)("storefront customer account", () => {
  let handle: DatabaseHandle;
  let storeAId: string;
  let storeBId: string;
  let publishableA: string;
  let publishableB: string;
  const createdCustomerIds: string[] = [];
  const createdCartIds: string[] = [];

  const env = {
    DATABASE_URL: process.env.DATABASE_URL!,
    JWT_SECRET: jwtSecret,
    ENVIRONMENT: "development",
  };

  async function request(
    path: string,
    init: RequestInit = {},
  ): Promise<{ status: number; body: Json }> {
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
    return { status: res.status, body };
  }

  async function register(publishableKey: string, suffix: string) {
    const email = `acct-${suffix}-${Date.now()}@example.com`;
    const res = await request("/api/v1/store/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-key": publishableKey,
      },
      body: JSON.stringify({
        email,
        password: "Customer@123",
        name: "Account Tester",
        phone: "9000000000",
      }),
    });
    expect(res.status).toBe(201);
    const data = res.body.data as {
      accessToken: string;
      customer: { id: string; email: string; phone: string | null; storeId: string };
    };
    createdCustomerIds.push(data.customer.id);
    return { token: data.accessToken, customer: data.customer, email };
  }

  function customerHeaders(publishableKey: string, token: string) {
    return {
      "Content-Type": "application/json",
      "x-publishable-key": publishableKey,
      Authorization: `Bearer ${token}`,
    };
  }

  const addressPayload = {
    name: "Ada Lovelace",
    phone: "9999999999",
    addressLine1: "12 MG Road",
    city: "Bengaluru",
    state: "KA",
    postalCode: "560001",
    country: "IN",
  };

  beforeAll(async () => {
    handle = createDb(process.env.DATABASE_URL!);
    const [alora, zentrix] = DEVELOPMENT_STORES;
    const storeA = await handle.db.query.stores.findFirst({ where: eq(stores.slug, alora!.slug) });
    const storeB = await handle.db.query.stores.findFirst({ where: eq(stores.slug, zentrix!.slug) });
    if (!storeA || !storeB) {
      throw new Error("Seed Alora Fashion / Zentrix before running customer account tests.");
    }
    storeAId = storeA.id;
    storeBId = storeB.id;
    const storeService = new StoreService(handle.db);
    publishableA = (await storeService.createKey(storeAId, "PUBLISHABLE")).rawKey;
    publishableB = (await storeService.createKey(storeBId, "PUBLISHABLE")).rawKey;
  });

  beforeEach(() => {
    resetRateLimitBuckets();
  });

  afterAll(async () => {
    for (const id of createdCartIds) {
      await handle.db.delete(carts).where(eq(carts.id, id));
    }
    for (const id of createdCustomerIds) {
      await handle.db.delete(customers).where(eq(customers.id, id));
    }
    await closeDb(handle);
  });

  it("returns and updates the full customer profile", async () => {
    const { token, customer } = await register(publishableA, "profile");
    expect(customer.phone).toBe("9000000000");
    expect(customer.storeId).toBe(storeAId);

    const me = await request("/api/v1/store/auth/me", {
      headers: customerHeaders(publishableA, token),
    });
    expect(me.status).toBe(200);
    const meData = me.body.data as {
      phone: string | null;
      dateOfBirth: string | null;
      gender: string | null;
    };
    expect(meData.phone).toBe("9000000000");
    expect(meData.dateOfBirth).toBeNull();
    expect(meData.gender).toBeNull();

    const patched = await request("/api/v1/store/auth/me", {
      method: "PATCH",
      headers: customerHeaders(publishableA, token),
      body: JSON.stringify({
        name: "Ada Updated",
        phone: "9111111111",
        dateOfBirth: "1994-05-20",
        gender: "FEMALE",
      }),
    });
    expect(patched.status).toBe(200);
    const profile = patched.body.data as {
      name: string;
      phone: string | null;
      dateOfBirth: string | null;
      gender: string | null;
      email: string;
    };
    expect(profile.name).toBe("Ada Updated");
    expect(profile.phone).toBe("9111111111");
    expect(profile.dateOfBirth).toBe("1994-05-20");
    expect(profile.gender).toBe("FEMALE");
    expect(profile.email).toBe(customer.email);

    const empty = await request("/api/v1/store/auth/me", {
      method: "PATCH",
      headers: customerHeaders(publishableA, token),
      body: JSON.stringify({}),
    });
    expect(empty.status).toBe(422);

    const future = await request("/api/v1/store/auth/me", {
      method: "PATCH",
      headers: customerHeaders(publishableA, token),
      body: JSON.stringify({ dateOfBirth: "2999-12-31" }),
    });
    expect(future.status).toBe(422);
  });

  it("manages saved addresses and a single default", async () => {
    const { token } = await register(publishableA, "addr");

    const first = await request("/api/v1/store/addresses", {
      method: "POST",
      headers: customerHeaders(publishableA, token),
      body: JSON.stringify(addressPayload),
    });
    expect(first.status).toBe(201);
    const firstAddress = first.body.data as { id: string; isDefault: boolean };
    expect(firstAddress.isDefault).toBe(true);

    const second = await request("/api/v1/store/addresses", {
      method: "POST",
      headers: customerHeaders(publishableA, token),
      body: JSON.stringify({
        ...addressPayload,
        addressLine1: "88 Brigade Road",
        isDefault: true,
      }),
    });
    expect(second.status).toBe(201);
    const secondAddress = second.body.data as { id: string; isDefault: boolean };
    expect(secondAddress.isDefault).toBe(true);

    const listed = await request("/api/v1/store/addresses", {
      headers: customerHeaders(publishableA, token),
    });
    expect(listed.status).toBe(200);
    const items = listed.body.data as Array<{ id: string; isDefault: boolean }>;
    expect(items[0]?.id).toBe(secondAddress.id);
    expect(items.filter((item) => item.isDefault)).toHaveLength(1);

    const fetched = await request(`/api/v1/store/addresses/${firstAddress.id}`, {
      headers: customerHeaders(publishableA, token),
    });
    expect(fetched.status).toBe(200);
    expect((fetched.body.data as { isDefault: boolean }).isDefault).toBe(false);

    const deleted = await request(`/api/v1/store/addresses/${secondAddress.id}`, {
      method: "DELETE",
      headers: customerHeaders(publishableA, token),
    });
    expect(deleted.status).toBe(200);

    const afterDelete = await request("/api/v1/store/addresses", {
      headers: customerHeaders(publishableA, token),
    });
    const remaining = afterDelete.body.data as Array<{ id: string; isDefault: boolean }>;
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.id).toBe(firstAddress.id);
    expect(remaining[0]?.isDefault).toBe(true);
  });

  it("applies a default address on cart create/attach and saves cart shipping", async () => {
    const { token } = await register(publishableA, "checkout");
    const created = await request("/api/v1/store/addresses", {
      method: "POST",
      headers: customerHeaders(publishableA, token),
      body: JSON.stringify({ ...addressPayload, isDefault: true }),
    });
    const addressId = (created.body.data as { id: string }).id;

    const cartWithJwt = await request("/api/v1/store/carts", {
      method: "POST",
      headers: customerHeaders(publishableA, token),
      body: "{}",
    });
    expect(cartWithJwt.status).toBe(201);
    const authedCart = cartWithJwt.body.data as {
      id: string;
      shippingAddressLine1: string | null;
    };
    createdCartIds.push(authedCart.id);
    expect(authedCart.shippingAddressLine1).toBe("12 MG Road");

    const guestCart = await request("/api/v1/store/carts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-key": publishableA,
      },
      body: "{}",
    });
    const guestCartId = (guestCart.body.data as { id: string }).id;
    createdCartIds.push(guestCartId);

    const attached = await request(`/api/v1/store/carts/${guestCartId}/customer`, {
      method: "POST",
      headers: customerHeaders(publishableA, token),
      body: "{}",
    });
    expect(attached.status).toBe(200);
    expect((attached.body.data as { shippingAddressLine1: string | null }).shippingAddressLine1).toBe(
      "12 MG Road",
    );

    const fromSaved = await request(`/api/v1/store/carts/${guestCartId}/shipping-address/from-saved`, {
      method: "POST",
      headers: customerHeaders(publishableA, token),
      body: JSON.stringify({ addressId }),
    });
    expect(fromSaved.status).toBe(200);

    const inlineCart = await request("/api/v1/store/carts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-key": publishableA,
      },
      body: "{}",
    });
    const inlineCartId = (inlineCart.body.data as { id: string }).id;
    createdCartIds.push(inlineCartId);

    await request(`/api/v1/store/carts/${inlineCartId}/shipping-address`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-key": publishableA,
      },
      body: JSON.stringify({
        ...addressPayload,
        addressLine1: "1 Residency Road",
      }),
    });

    const saved = await request(`/api/v1/store/carts/${inlineCartId}/shipping-address/save`, {
      method: "POST",
      headers: customerHeaders(publishableA, token),
      body: JSON.stringify({ isDefault: false }),
    });
    expect(saved.status).toBe(201);
    expect((saved.body.data as { addressLine1: string }).addressLine1).toBe("1 Residency Road");
  });

  it("keeps Store A profile and addresses isolated from Store B", async () => {
    const storeA = await register(publishableA, "iso-a");
    const storeB = await register(publishableB, "iso-b");

    const createdB = await request("/api/v1/store/addresses", {
      method: "POST",
      headers: customerHeaders(publishableB, storeB.token),
      body: JSON.stringify(addressPayload),
    });
    const addressBId = (createdB.body.data as { id: string }).id;

    const crossKey = await request("/api/v1/store/auth/me", {
      headers: customerHeaders(publishableB, storeA.token),
    });
    expect(crossKey.status).toBe(401);

    const crossAddress = await request(`/api/v1/store/addresses/${addressBId}`, {
      headers: customerHeaders(publishableA, storeA.token),
    });
    expect(crossAddress.status).toBe(404);

    const crossPatch = await request(`/api/v1/store/addresses/${addressBId}`, {
      method: "PATCH",
      headers: customerHeaders(publishableA, storeA.token),
      body: JSON.stringify({ isDefault: true }),
    });
    expect(crossPatch.status).toBe(404);
  });
});
