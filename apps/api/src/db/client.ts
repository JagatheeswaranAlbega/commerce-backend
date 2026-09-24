import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import { schema } from "@/db/schema";
import { getEnv } from "@/infrastructure/env/env";
import { resolveDatabaseUrl } from "@/infrastructure/database/connection";

export type Database = PostgresJsDatabase<typeof schema>;

export type DatabaseHandle = {
  db: Database;
  client: Sql;
  connectionString: string;
};

const workerPostgresOptions = {
  // Hyperdrive pools upstream connections; keep the Worker-side pool small.
  max: 1,
  fetch_types: false,
} as const;

export function createDb(connectionString: string): DatabaseHandle {
  const client = postgres(connectionString, workerPostgresOptions);
  const db = drizzle(client, { schema });

  return { db, client, connectionString };
}

/**
 * Create a request-scoped database handle.
 * Do not cache the client across Cloudflare Worker requests — I/O is request-bound.
 */
export async function openDb(fallbackUrl?: string): Promise<DatabaseHandle> {
  const connectionString = await resolveDatabaseUrl(fallbackUrl ?? getEnv().DATABASE_URL);
  return createDb(connectionString);
}

/** @deprecated Prefer openDb() + explicit client.end() / waitUntil for Workers. */
export async function getDb(): Promise<Database> {
  const handle = await openDb();
  return handle.db;
}

export async function closeDb(handle?: DatabaseHandle): Promise<void> {
  if (!handle) {
    return;
  }

  await handle.client.end({ timeout: 5 });
}
