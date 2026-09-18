import { describe, expect, it } from "vitest";
import { USER_ROLES } from "@/modules/auth/auth.types";
import { signAuthToken, verifyAuthToken } from "@/modules/auth/jwt";

describe("auth jwt", () => {
  const secret = "test-secret-at-least-32-characters-long";

  it("signs and verifies platform admin tokens", async () => {
    const token = await signAuthToken(
      {
        sub: "user-1",
        role: USER_ROLES.PLATFORM_SUPER_ADMIN,
        storeId: null,
        typ: "admin",
      },
      { secret },
    );
    const payload = await verifyAuthToken(token, { secret });
    expect(payload.typ).toBe("admin");
    if (payload.typ === "admin") {
      expect(payload.role).toBe(USER_ROLES.PLATFORM_SUPER_ADMIN);
      expect(payload.storeId).toBeNull();
    }
  });

  it("signs and verifies store admin tokens with storeId", async () => {
    const token = await signAuthToken(
      {
        sub: "user-2",
        role: USER_ROLES.STORE_ADMIN,
        storeId: "store-a",
        typ: "admin",
      },
      { secret },
    );
    const payload = await verifyAuthToken(token, { secret });
    expect(payload.typ).toBe("admin");
    if (payload.typ === "admin") {
      expect(payload.role).toBe(USER_ROLES.STORE_ADMIN);
      expect(payload.storeId).toBe("store-a");
    }
  });
});
