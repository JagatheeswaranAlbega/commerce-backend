import { describe, expect, it } from "vitest";
import { normalizeDatabaseUrl } from "@/infrastructure/database/connection";

describe("normalizeDatabaseUrl", () => {
  it("rewrites Neon pooler host to direct host", () => {
    const input =
      "postgresql://user:pass@ep-test-pooler.c-7.us-east-2.aws.neon.tech/db?sslmode=require&channel_binding=require";
    const out = normalizeDatabaseUrl(input);
    const url = new URL(out);
    expect(url.hostname).toBe("ep-test.c-7.us-east-2.aws.neon.tech");
    expect(url.searchParams.get("sslmode")).toBe("require");
    expect(url.searchParams.get("channel_binding")).toBe("disable");
  });

  it("leaves non-Neon hosts unchanged aside from parsing", () => {
    const input = "postgresql://postgres:admin@localhost:5432/ecommerce_multi_tenancy";
    const out = normalizeDatabaseUrl(input);
    const url = new URL(out);
    expect(url.hostname).toBe("localhost");
    expect(url.port).toBe("5432");
  });
});
