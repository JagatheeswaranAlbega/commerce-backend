import type { Database } from "@/db/client";
import { stores } from "@/db/schema/stores";
import { users } from "@/db/schema/users";
import { apiKeys } from "@/db/schema/api-keys";
import { storeSettings } from "@/db/schema/store-settings";
import { and, count, desc, eq } from "drizzle-orm";
import { generateApiKey, sha256Hex } from "@/infrastructure/crypto/api-key";
import { hashPassword } from "@/infrastructure/crypto/password";
import {
  DuplicateResourceError,
  NotFoundError,
  StoreNotFoundError,
} from "@/shared/errors/app-error";
import { normalizeEmail, normalizeSlug } from "@/shared/tenant/normalize";

export type CreateStoreInput = {
  name: string;
  slug: string;
  adminEmail: string;
  adminPassword: string;
};

export class StoreService {
  constructor(private readonly db: Database) {}

  async list(page: number, pageSize: number) {
    const offset = (page - 1) * pageSize;
    const [items, totalRow] = await Promise.all([
      this.db.query.stores.findMany({
        orderBy: [desc(stores.createdAt)],
        limit: pageSize,
        offset,
      }),
      this.db.select({ total: count() }).from(stores),
    ]);
    return {
      items,
      total: Number(totalRow[0]?.total ?? 0),
      page,
      pageSize,
    };
  }

  async get(storeId: string) {
    const store = await this.db.query.stores.findFirst({ where: eq(stores.id, storeId) });
    if (!store) throw new StoreNotFoundError();
    return store;
  }

  async create(input: CreateStoreInput) {
    const slug = normalizeSlug(input.slug);
    const adminEmail = normalizeEmail(input.adminEmail);
    const existingSlug = await this.db.query.stores.findFirst({ where: eq(stores.slug, slug) });
    if (existingSlug) throw new DuplicateResourceError("Store slug already exists.");
    const existingUser = await this.db.query.users.findFirst({ where: eq(users.email, adminEmail) });
    if (existingUser) throw new DuplicateResourceError("Admin email already exists.");

    const [store] = await this.db
      .insert(stores)
      .values({ name: input.name, slug, status: "ACTIVE" })
      .returning();

    const passwordHash = await hashPassword(input.adminPassword);
    const [admin] = await this.db
      .insert(users)
      .values({
        email: adminEmail,
        passwordHash,
        role: "STORE_ADMIN",
        storeId: store!.id,
        isActive: true,
      })
      .returning({ id: users.id, email: users.email, role: users.role, storeId: users.storeId });

    await this.db.insert(storeSettings).values([
      { storeId: store!.id, key: "currency", value: "INR" },
      { storeId: store!.id, key: "timezone", value: "Asia/Kolkata" },
      {
        storeId: store!.id,
        key: "shipping",
        value: {
          mode: "flat",
          flatPaise: 20_000,
          freeOverPaise: null,
        },
      },
      {
        storeId: store!.id,
        key: "tax",
        value: { gstPercent: 3, gstin: null },
      },
    ]);

    const publishable = generateApiKey("PUBLISHABLE");
    const secret = generateApiKey("SECRET");
    await this.db.insert(apiKeys).values([
      {
        storeId: store!.id,
        type: "PUBLISHABLE",
        keyPrefix: publishable.prefix,
        secretHash: await sha256Hex(publishable.rawKey),
        status: "ACTIVE",
      },
      {
        storeId: store!.id,
        type: "SECRET",
        keyPrefix: secret.prefix,
        secretHash: await sha256Hex(secret.rawKey),
        status: "ACTIVE",
      },
    ]);

    return {
      store: store!,
      admin,
      keys: {
        publishableKey: publishable.rawKey,
        secretKey: secret.rawKey,
      },
    };
  }

  async update(
    storeId: string,
    input: { name?: string; status?: "ACTIVE" | "INACTIVE" },
  ) {
    const [store] = await this.db
      .update(stores)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(stores.id, storeId))
      .returning();
    if (!store) throw new StoreNotFoundError();
    return store;
  }

  async deactivate(storeId: string) {
    return this.update(storeId, { status: "INACTIVE" });
  }

  async listAdmins(storeId: string) {
    await this.get(storeId);
    return this.db.query.users.findMany({
      where: and(eq(users.storeId, storeId), eq(users.role, "STORE_ADMIN")),
      columns: { id: true, email: true, role: true, storeId: true, isActive: true, createdAt: true },
    });
  }

  async createAdmin(storeId: string, input: { email: string; password: string }) {
    await this.get(storeId);
    const email = normalizeEmail(input.email);
    const existing = await this.db.query.users.findFirst({ where: eq(users.email, email) });
    if (existing) throw new DuplicateResourceError("Email already exists.");
    const passwordHash = await hashPassword(input.password);
    const [admin] = await this.db
      .insert(users)
      .values({
        email,
        passwordHash,
        role: "STORE_ADMIN",
        storeId,
        isActive: true,
      })
      .returning({ id: users.id, email: users.email, role: users.role, storeId: users.storeId });
    return admin!;
  }

  async updateAdmin(
    storeId: string,
    userId: string,
    input: { email?: string; password?: string; isActive?: boolean },
  ) {
    await this.get(storeId);
    const admin = await this.db.query.users.findFirst({
      where: and(eq(users.id, userId), eq(users.storeId, storeId), eq(users.role, "STORE_ADMIN")),
    });
    if (!admin) throw new NotFoundError("Store admin not found.");
    if (input.email) {
      const email = normalizeEmail(input.email);
      const conflict = await this.db.query.users.findFirst({ where: eq(users.email, email) });
      if (conflict && conflict.id !== userId) throw new DuplicateResourceError("Email already exists.");
    }
    const [updated] = await this.db
      .update(users)
      .set({
        ...(input.email !== undefined ? { email: normalizeEmail(input.email) } : {}),
        ...(input.password !== undefined ? { passwordHash: await hashPassword(input.password) } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, userId), eq(users.storeId, storeId)))
      .returning({
        id: users.id,
        email: users.email,
        role: users.role,
        storeId: users.storeId,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });
    if (!updated) throw new NotFoundError("Store admin not found.");
    return updated;
  }

  async removeAdmin(storeId: string, userId: string) {
    await this.get(storeId);
    const deleted = await this.db
      .delete(users)
      .where(and(eq(users.id, userId), eq(users.storeId, storeId), eq(users.role, "STORE_ADMIN")))
      .returning({ id: users.id });
    if (deleted.length === 0) throw new NotFoundError("Store admin not found.");
    return { deleted: true as const };
  }

  async listKeys(storeId: string) {
    await this.get(storeId);
    return this.db.query.apiKeys.findMany({
      where: and(eq(apiKeys.storeId, storeId), eq(apiKeys.status, "ACTIVE")),
      columns: {
        id: true,
        storeId: true,
        type: true,
        keyPrefix: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [desc(apiKeys.createdAt)],
    });
  }

  async createKey(storeId: string, type: "PUBLISHABLE" | "SECRET") {
    await this.get(storeId);
    const generated = generateApiKey(type);
    const [key] = await this.db
      .insert(apiKeys)
      .values({
        storeId,
        type,
        keyPrefix: generated.prefix,
        secretHash: await sha256Hex(generated.rawKey),
        status: "ACTIVE",
      })
      .returning({
        id: apiKeys.id,
        storeId: apiKeys.storeId,
        type: apiKeys.type,
        keyPrefix: apiKeys.keyPrefix,
        status: apiKeys.status,
        createdAt: apiKeys.createdAt,
      });
    return { ...key!, rawKey: generated.rawKey };
  }

  async deleteKey(storeId: string, keyId: string) {
    const [key] = await this.db
      .delete(apiKeys)
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.storeId, storeId)))
      .returning({ id: apiKeys.id });
    if (!key) throw new NotFoundError("API key not found.");
    return { id: key.id, deleted: true as const };
  }
}
