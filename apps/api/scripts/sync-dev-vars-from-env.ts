/**
 * Sync apps/api/.dev.vars DATABASE_URL from .env Neon URL (no secret printing).
 * Also rewrite Neon pooler hosts → direct hosts for Hyperdrive compatibility.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function normalizeNeonUrl(raw: string): string {
  const trimmed = raw.trim().replace(/^["']|["']$/g, "");
  const url = new URL(trimmed);
  if (url.hostname.includes("neon.tech") && url.hostname.includes("-pooler.")) {
    url.hostname = url.hostname.replace("-pooler.", ".");
  }
  if (url.hostname.includes("neon.tech")) {
    url.searchParams.set("sslmode", "require");
  }
  if (url.searchParams.get("channel_binding") === "require") {
    url.searchParams.set("channel_binding", "disable");
  }
  return url.toString();
}

function upsertEnvLine(content: string, key: string, value: string): string {
  const line = `${key}="${value}"`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(content)) {
    return content.replace(pattern, line);
  }
  return `${content.trimEnd()}\n${line}\n`;
}

const root = resolve(import.meta.dirname, "..");
const envPath = resolve(root, ".env");
const devVarsPath = resolve(root, ".dev.vars");

if (!existsSync(envPath)) {
  console.error("Missing .env");
  process.exit(1);
}

const envContent = readFileSync(envPath, "utf8");
const dbMatch = envContent.match(/^DATABASE_URL=(.*)$/m);
if (!dbMatch) {
  console.error("DATABASE_URL not found in .env");
  process.exit(1);
}

const normalized = normalizeNeonUrl(dbMatch[1]!);
const host = new URL(normalized).hostname;
console.log("Normalized DATABASE_URL host:", host);

let nextEnv = upsertEnvLine(envContent, "DATABASE_URL", normalized);
nextEnv = upsertEnvLine(
  nextEnv,
  "CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE",
  normalized,
);
writeFileSync(envPath, nextEnv, "utf8");
console.log("Updated .env Hyperdrive + DATABASE_URL hosts");

let devVars = existsSync(devVarsPath)
  ? readFileSync(devVarsPath, "utf8")
  : "ENVIRONMENT=development\n";
devVars = upsertEnvLine(devVars, "DATABASE_URL", normalized);
if (!/^JWT_SECRET=/m.test(devVars)) {
  const jwt = envContent.match(/^JWT_SECRET=(.*)$/m)?.[1]?.replace(/^["']|["']$/g, "");
  if (jwt) devVars = upsertEnvLine(devVars, "JWT_SECRET", jwt);
}
if (!/^FRONTEND_URL=/m.test(devVars)) {
  const fe = envContent.match(/^FRONTEND_URL=(.*)$/m)?.[1]?.replace(/^["']|["']$/g, "");
  if (fe) devVars = upsertEnvLine(devVars, "FRONTEND_URL", fe);
}
if (!/^ENVIRONMENT=/m.test(devVars)) {
  devVars = upsertEnvLine(devVars, "ENVIRONMENT", "development");
}
writeFileSync(devVarsPath, devVars, "utf8");
console.log("Synced .dev.vars DATABASE_URL to same Neon host");
console.log("Restart `wrangler dev` for the new Hyperdrive local connection string.");
