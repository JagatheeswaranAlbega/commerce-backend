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

export async function resolveDatabaseUrl(fallbackUrl?: string): Promise<string> {
  const hyperdriveUrl = await readHyperdriveConnectionString();
  if (hyperdriveUrl) {
    return hyperdriveUrl;
  }

  if (fallbackUrl) {
    return fallbackUrl;
  }

  throw new DatabaseConfigError();
}
