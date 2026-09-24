import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, createDb, type DatabaseHandle } from "@/db/client";
import { stores } from "@/db/schema/stores";
import { users } from "@/db/schema/users";
import { StoreNotFoundError } from "@/shared/errors/app-error";
import { StoreService } from "@/modules/store/store.service";

config({ path: ".env" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDb)("store lifecycle (db)", () => {
  let handle: DatabaseHandle;

  beforeAll(() => {
    handle = createDb(process.env.DATABASE_URL!);
  });

  afterAll(async () => {
    await closeDb(handle);
  });

  it("deactivates a store without deleting it", async () => {
    const service = new StoreService(handle.db);
    const stamp = Date.now();
    const created = await service.create({
      name: `Deactivate ${stamp}`,
      slug: `deactivate-${stamp}`,
    });

    const deactivated = await service.deactivate(created.store.id);
    expect(deactivated.status).toBe("INACTIVE");

    const stillThere = await service.get(created.store.id);
    expect(stillThere.id).toBe(created.store.id);
    expect(stillThere.status).toBe("INACTIVE");

    await service.remove(created.store.id);
  });

  it("creates a store without a store admin", async () => {
    const service = new StoreService(handle.db);
    const stamp = Date.now();
    const created = await service.create({
      name: `Standalone ${stamp}`,
      slug: `standalone-${stamp}`,
    });

    expect(created.store.slug).toBe(`standalone-${stamp}`);
    expect(created.keys.publishableKey).toMatch(/^pk_/);
    expect(created.keys.secretKey).toMatch(/^sk_/);

    const admins = await service.listAdmins(created.store.id);
    expect(admins).toHaveLength(0);

    await service.remove(created.store.id);
  });

  it("hard-deletes a store and its store admin", async () => {
    const service = new StoreService(handle.db);
    const stamp = Date.now();
    const created = await service.create({
      name: `Delete ${stamp}`,
      slug: `delete-${stamp}`,
    });
    const adminEmail = `delete-${stamp}@example.com`;
    await service.createAdmin(created.store.id, {
      email: adminEmail,
      password: "TempPass@123",
    });

    const removed = await service.remove(created.store.id);
    expect(removed.id).toBe(created.store.id);
    expect(removed.slug).toBe(`delete-${stamp}`);

    await expect(service.get(created.store.id)).rejects.toBeInstanceOf(StoreNotFoundError);

    const admin = await handle.db.query.users.findFirst({
      where: eq(users.email, adminEmail),
    });
    expect(admin).toBeUndefined();

    const leftover = await handle.db.query.stores.findFirst({
      where: eq(stores.id, created.store.id),
    });
    expect(leftover).toBeUndefined();
  });
});
