export class DatabaseConfigError extends Error {
  constructor(message = "Database configuration is missing.") {
    super(message);
    this.name = "DatabaseConfigError";
  }
}

type HyperdriveBinding = {
  connectionString?: string;
};

async function readHyperdriveConnectionString(): Promise<string | undefined> {
  try {
    const { env } = await import("cloudflare:workers");
    const hyperdrive = (env as { HYPERDRIVE?: HyperdriveBinding }).HYPERDRIVE;
    return hyperdrive?.connectionString;
  } catch {
    return undefined;
  }
}

/**
 * Normalize Neon / Workers-compatible connection strings.
 *
 * - Hyperdrive should use Neon's **direct** (non-pooler) endpoint — Hyperdrive
 *   already pools. Double-pooling via `-pooler` hosts breaks many queries.
 * - `channel_binding=require` is rejected by some Workers/TLS paths; prefer disable.
 * - Ensure `sslmode=require` for neon.tech hosts.
 */
export function normalizeDatabaseUrl(connectionString: string): string {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return connectionString;
  }

  const host = url.hostname.toLowerCase();
  if (host.includes("neon.tech") && host.includes("-pooler.")) {
    url.hostname = host.replace("-pooler.", ".");
  }

  if (host.includes("neon.tech") || url.searchParams.get("sslmode")) {
    url.searchParams.set("sslmode", "require");
  }

  if (url.searchParams.get("channel_binding") === "require") {
    url.searchParams.set("channel_binding", "disable");
  }

  return url.toString();
}

export function databaseHostLabel(connectionString: string): string {
  try {
    return new URL(connectionString).hostname;
  } catch {
    return "invalid-url";
  }
}

export function isNeonHost(connectionString: string): boolean {
  try {
    return new URL(connectionString).hostname.toLowerCase().includes("neon.tech");
  } catch {
    return false;
  }
}

export function isNeonPoolerHost(connectionString: string): boolean {
  try {
    return new URL(connectionString).hostname.toLowerCase().includes("-pooler.");
  } catch {
    return false;
  }
}

/**
 * Resolve the DB URL for this request.
 *
 * Prefer Neon `DATABASE_URL` when present so Workers use the Neon HTTP driver
 * (see createDb). Otherwise use Hyperdrive (postgres.js) for non-Neon Postgres.
 */
export async function resolveDatabaseUrl(fallbackUrl?: string): Promise<string> {
  if (fallbackUrl) {
    const normalizedFallback = normalizeDatabaseUrl(fallbackUrl);
    if (isNeonHost(normalizedFallback)) {
      return normalizedFallback;
    }
  }

  const hyperdriveUrl = await readHyperdriveConnectionString();
  if (hyperdriveUrl) {
    return normalizeDatabaseUrl(hyperdriveUrl);
  }

  if (fallbackUrl) {
    return normalizeDatabaseUrl(fallbackUrl);
  }

  throw new DatabaseConfigError();
}
