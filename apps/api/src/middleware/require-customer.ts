import type { Context } from "hono";
import { ACCESS_TYPES } from "@/modules/auth/auth.types";
import { extractBearerToken, verifyAuthToken } from "@/modules/auth/jwt";
import { AUTHORIZATION_HEADER } from "@/shared/constants/headers";
import { UnauthorizedError } from "@/shared/errors/app-error";
import type { AppEnv } from "@/shared/types/hono";

/** Resolve optional customer JWT while keeping publishable-key store scope. */
export async function resolveOptionalCustomerId(
  c: Context<AppEnv>,
  storeId: string,
): Promise<string | null> {
  const token = extractBearerToken(c.req.header(AUTHORIZATION_HEADER));
  if (!token) return null;

  const payload = await verifyAuthToken(token, {
    secret: c.env?.JWT_SECRET || process.env.JWT_SECRET,
  });
  if (payload.typ !== "customer" || payload.storeId !== storeId) {
    throw new UnauthorizedError("Customer authentication is invalid for this store.");
  }

  const existing = c.get("auth");
  c.set("auth", {
    ...existing,
    accessType: ACCESS_TYPES.CUSTOMER,
    customerId: payload.sub,
    storeId,
  });
  return payload.sub;
}

export async function requireCustomerId(c: Context<AppEnv>, storeId: string): Promise<string> {
  const customerId = await resolveOptionalCustomerId(c, storeId);
  if (!customerId) throw new UnauthorizedError("Customer authentication is required.");
  return customerId;
}
