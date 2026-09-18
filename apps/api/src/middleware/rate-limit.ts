import type { Context, MiddlewareHandler, Next } from "hono";
import { RateLimitedError } from "@/shared/errors/app-error";
import type { AppEnv } from "@/shared/types/hono";

export type RateLimitOptions = {
  /** Max requests allowed in the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Logical bucket name (e.g. auth.login). */
  keyPrefix: string;
};

type Bucket = number[];

/** Process-local sliding windows. Swap for DO/KV in multi-isolate production. */
const buckets = new Map<string, Bucket>();

export function resetRateLimitBuckets() {
  buckets.clear();
}

function clientIp(c: Context<AppEnv>): string {
  const cf = c.req.header("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return "unknown";
}

export function rateLimit(options: RateLimitOptions): MiddlewareHandler<AppEnv> {
  const { limit, windowMs, keyPrefix } = options;

  return async (c: Context<AppEnv>, next: Next) => {
    const now = Date.now();
    const key = `${keyPrefix}:${clientIp(c)}`;
    const windowStart = now - windowMs;
    const existing = buckets.get(key) ?? [];
    const recent = existing.filter((ts) => ts > windowStart);

    if (recent.length >= limit) {
      buckets.set(key, recent);
      throw new RateLimitedError("Too many requests. Please try again later.", {
        limit,
        windowMs,
        retryAfterMs: Math.max(0, recent[0]! + windowMs - now),
      });
    }

    recent.push(now);
    buckets.set(key, recent);
    await next();
  };
}

/** Auth endpoints: tight limit. */
export const authRateLimit = () =>
  rateLimit({ limit: 20, windowMs: 60_000, keyPrefix: "auth" });

/** Storefront mutating routes: lighter limit. */
export const storefrontMutationRateLimit = () =>
  rateLimit({ limit: 120, windowMs: 60_000, keyPrefix: "store.mutate" });
