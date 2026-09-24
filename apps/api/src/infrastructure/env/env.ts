import { envSchema, type ParsedEnv } from "@/infrastructure/env/env.schema";

export class EnvValidationError extends Error {
  constructor(message = "Invalid environment configuration.") {
    super(message);
    this.name = "EnvValidationError";
  }
}

export type EnvSource = Record<string, string | undefined>;

function readStringRecord(source: EnvSource): EnvSource {
  return {
    ENVIRONMENT: source.ENVIRONMENT,
    DATABASE_URL: source.DATABASE_URL,
    JWT_SECRET: source.JWT_SECRET,
    FRONTEND_URL: source.FRONTEND_URL,
    ZEPTOMAIL_TOKEN: source.ZEPTOMAIL_TOKEN,
    ZEPTOMAIL_FROM: source.ZEPTOMAIL_FROM,
    ZEPTOMAIL_FROM_NAME: source.ZEPTOMAIL_FROM_NAME,
    ZEPTOMAIL_API_URL: source.ZEPTOMAIL_API_URL,
  };
}

export function parseEnv(source: EnvSource = process.env): ParsedEnv {
  const result = envSchema.safeParse(readStringRecord(source));

  if (!result.success) {
    throw new EnvValidationError();
  }

  const env = result.data;

  if (env.ENVIRONMENT === "production" && (!env.DATABASE_URL || !env.JWT_SECRET)) {
    throw new EnvValidationError();
  }

  return env;
}

let cachedEnv: ParsedEnv | undefined;

export function getEnv(): ParsedEnv {
  if (!cachedEnv) {
    cachedEnv = parseEnv();
  }

  return cachedEnv;
}

export function resetEnvCache(): void {
  cachedEnv = undefined;
}
