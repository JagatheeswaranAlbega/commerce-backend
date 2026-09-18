import { eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { platformSettings } from "@/db/schema/platform-settings";
import { users } from "@/db/schema/users";
import { hashPassword } from "@/infrastructure/crypto/password";
import { normalizeEmail } from "@/shared/tenant/normalize";
import { DEMO_STORES } from "./seed/demo-stores";
import type { FixtureStoreSeed, SeededStoreSummary } from "./seed/types";
import { seedDemoStore, seedFixtureStore } from "./seed/upsert";

export type DevelopmentStoreSeed = FixtureStoreSeed;

/** Minimal fixtures used by isolation tests. */
export const DEVELOPMENT_STORES: readonly DevelopmentStoreSeed[] = [
  {
    name: "Store A",
    slug: "store-a",
    adminEmail: "admin@store-a.local",
  },
  {
    name: "Store B",
    slug: "store-b",
    adminEmail: "admin@store-b.local",
  },
];

export type SeedResult = {
  platformAdminEmail: string;
  stores: SeededStoreSummary[];
};

type SeedInput = {
  storePassword: string;
  platformAdminEmail?: string;
  platformAdminPassword?: string;
};

async function upsertPlatformAdmin(
  db: Database,
  email: string,
  password: string,
): Promise<void> {
  const normalized = normalizeEmail(email);
  const passwordHash = await hashPassword(password);
  const existing = await db.query.users.findFirst({
    where: eq(users.email, normalized),
  });
  if (existing) {
    await db
      .update(users)
      .set({
        passwordHash,
        role: "PLATFORM_SUPER_ADMIN",
        storeId: null,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id));
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

export async function seedDevelopmentData(db: Database, input: SeedInput): Promise<SeedResult> {
  const platformAdminEmail = normalizeEmail(input.platformAdminEmail ?? "platform@local.dev");
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

  const seededStores: SeededStoreSummary[] = [];

  for (const store of DEVELOPMENT_STORES) {
    seededStores.push(await seedFixtureStore(db, store, storePasswordHash));
  }

  for (const store of DEMO_STORES) {
    seededStores.push(await seedDemoStore(db, store, storePasswordHash));
  }

  return {
    platformAdminEmail,
    stores: seededStores,
  };
}
