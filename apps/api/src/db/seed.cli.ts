import { config } from "dotenv";
import { closeDb, createDb } from "@/db/client";
import { seedDevelopmentData } from "@/db/seed";

config({ path: ".env" });

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required to seed development data.`);
  }
  return value;
}

async function main() {
  const databaseUrl = requiredEnv("DATABASE_URL");
  const handle = createDb(databaseUrl);

  try {
    const result = await seedDevelopmentData(handle.db, {
      storePassword: requiredEnv("SEED_STORE_PASSWORD"),
      platformAdminEmail: process.env.SEED_PLATFORM_ADMIN_EMAIL ?? process.env.SEED_SUPER_ADMIN_EMAIL,
      platformAdminPassword:
        process.env.SEED_PLATFORM_ADMIN_PASSWORD ?? process.env.SEED_SUPER_ADMIN_PASSWORD,
    });

    console.log("Seed completed.");
    console.log(`Platform admin: ${result.platformAdminEmail}`);
    for (const store of result.stores) {
      console.log(`--- ${store.slug} (${store.id}) ---`);
      console.log(`  admin: ${store.adminEmail}`);
      console.log(`  publishable_key: ${store.publishableKey}`);
      console.log(`  secret_key: ${store.secretKey}`);
    }
  } finally {
    await closeDb(handle);
  }
}

main().catch((error) => {
  console.error("Seed failed.", error);
  process.exit(1);
});
