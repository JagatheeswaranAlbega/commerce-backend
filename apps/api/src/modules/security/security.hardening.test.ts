import { describe, expect, it, beforeEach } from "vitest";
import { Hono } from "hono";
import { rateLimit, resetRateLimitBuckets } from "@/middleware/rate-limit";
import { secureHeadersMiddleware } from "@/middleware/secure-headers";
import { redactHeaders, redactValue } from "@/shared/logging/redact";
import { sanitizeAuditMetadata } from "@/modules/audit";
import { RateLimitedError } from "@/shared/errors/app-error";
import { createApp } from "@/app";
import type { AppEnv } from "@/shared/types/hono";

describe("redaction", () => {
  it("redacts authorization and api key headers", () => {
    const redacted = redactHeaders({
      Authorization: "Bearer sk_live_supersecret",
      "x-publishable-key": "pk_live_abcdef",
      "Content-Type": "application/json",
    });
    expect(redacted.Authorization).toBe("[REDACTED]");
    expect(redacted["x-publishable-key"]).toBe("[REDACTED]");
    expect(redacted["Content-Type"]).toBe("application/json");
  });

  it("redacts sensitive body fields", () => {
    const redacted = redactValue({
      email: "a@b.com",
      password: "secret",
      nested: { refreshToken: "tok", ok: true },
    }) as Record<string, unknown>;
    expect(redacted.password).toBe("[REDACTED]");
    expect((redacted.nested as Record<string, unknown>).refreshToken).toBe("[REDACTED]");
    expect(redacted.email).toBe("a@b.com");
  });

  it("strips secrets from audit metadata", () => {
    expect(
      sanitizeAuditMetadata({
        slug: "store-a",
        password: "nope",
        rawKey: "sk_live_x",
        type: "SECRET",
      }),
    ).toEqual({ slug: "store-a", type: "SECRET" });
  });
});

describe("rateLimit middleware", () => {
  beforeEach(() => {
    resetRateLimitBuckets();
  });

  it("returns 429 after the limit is exceeded", async () => {
    const app = new Hono<AppEnv>();
    app.onError((err, c) => {
      if (err instanceof RateLimitedError) {
        return c.json(
          { status: "error", message: err.message, errors: [{ code: err.code }] },
          err.status as 429,
        );
      }
      throw err;
    });
    app.use("*", rateLimit({ limit: 3, windowMs: 60_000, keyPrefix: "unit" }));
    app.get("/", (c) => c.json({ ok: true }));

    for (let i = 0; i < 3; i++) {
      const res = await app.request("/", { headers: { "x-forwarded-for": "10.0.0.9" } });
      expect(res.status).toBe(200);
    }
    const limited = await app.request("/", { headers: { "x-forwarded-for": "10.0.0.9" } });
    expect(limited.status).toBe(429);
    const body = await limited.json();
    expect(body.errors[0].code).toBe("RATE_LIMITED");
  });
});

describe("secure headers", () => {
  it("sets security headers on API responses", async () => {
    const app = createApp();
    const mini = new Hono<AppEnv>();
    mini.use("*", secureHeadersMiddleware());
    mini.get("/ping", (c) => c.json({ ok: true }));

    const res = await mini.request("/ping");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(res.headers.get("Cache-Control")).toBe("no-store");

    // createApp also mounts the middleware
    const health = await app.request("/api/v1/health");
    expect(health.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
