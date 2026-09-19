import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql, type Options } from "postgres";
import { schema } from "@/db/schema";
import { getEnv } from "@/infrastructure/env/env";
import {
  databaseHostLabel,
  isNeonPoolerHost,
  normalizeDatabaseUrl,
  resolveDatabaseUrl,
} from "@/infrastructure/database/connection";
import { postgresErrorFields } from "@/shared/logging/postgres-error";

export type Database = PostgresJsDatabase<typeof schema>;

export type DatabaseHandle = {
  db: Database;
  client: Sql;
  connectionString: string;
  close: () => Promise<void>;
};

/**
 * Cloudflare Workers + Hyperdrive / Neon options (postgres.js).
 * Requires `nodejs_compat` for TCP sockets in Workers.
 * See: https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/
 */
function workerPostgresOptions(connectionString: string): Options<{}> {
  const usePooler = isNeonPoolerHost(connectionString);
  return {
    max: 1,
    fetch_types: false,
    // Named prepared statements are incompatible with Neon pooler / PgBouncer.
    prepare: !usePooler,
    connect_timeout: 15,
  };
}

export function createDb(rawConnectionString: string): DatabaseHandle {
  const connectionString = normalizeDatabaseUrl(rawConnectionString);
  const client = postgres(connectionString, workerPostgresOptions(connectionString));
  const db = drizzle(client, { schema });

  return {
    db,
    client,
    connectionString,
    close: async () => {
      await client.end({ timeout: 5 });
    },
  };
}

/**
 * Create a request-scoped database handle.
 * Do not cache the client across Cloudflare Worker requests — I/O is request-bound.
 */
export async function openDb(fallbackUrl?: string): Promise<DatabaseHandle> {
  const connectionString = await resolveDatabaseUrl(fallbackUrl ?? getEnv().DATABASE_URL);
  try {
    return createDb(connectionString);
  } catch (error) {
    console.error("Failed to open database connection:", {
      host: databaseHostLabel(connectionString),
      ...postgresErrorFields(error),
    });
    throw error;
  }
}

/** @deprecated Prefer openDb() + explicit close for Workers. */
export async function getDb(): Promise<Database> {
  const handle = await openDb();
  return handle.db;
}

export async function closeDb(handle?: DatabaseHandle): Promise<void> {
  if (!handle) {
    return;
  }

  await handle.close();
}
