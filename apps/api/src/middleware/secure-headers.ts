import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "@/shared/types/hono";

/** Baseline API security headers for JSON responses. */
export function secureHeadersMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("Referrer-Policy", "no-referrer");
    c.header("Cache-Control", "no-store");
    c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  };
}
