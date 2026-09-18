import { SignJWT, jwtVerify } from "jose";
import type { AuthJwtPayload } from "@/modules/auth/auth.types";
import { UnauthorizedError } from "@/shared/errors/app-error";

const DEFAULT_TTL_SECONDS = 60 * 60 * 24;

function getSecretKey(secret?: string): Uint8Array {
  const value = secret ?? process.env.JWT_SECRET;
  if (!value) {
    throw new Error("JWT_SECRET is not configured.");
  }
  return new TextEncoder().encode(value);
}

export async function signAuthToken(
  claims: AuthJwtPayload,
  options: { secret?: string; expiresInSeconds?: number } = {},
): Promise<string> {
  const ttl = options.expiresInSeconds ?? DEFAULT_TTL_SECONDS;
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(getSecretKey(options.secret));
}

export async function verifyAuthToken(
  token: string,
  options: { secret?: string } = {},
): Promise<AuthJwtPayload> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(options.secret));
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    const typ = payload.typ;
    if (!sub || (typ !== "admin" && typ !== "customer")) {
      throw new UnauthorizedError("Invalid authentication token.");
    }
    if (typ === "admin") {
      const role = payload.role;
      if (role !== "PLATFORM_SUPER_ADMIN" && role !== "STORE_ADMIN") {
        throw new UnauthorizedError("Invalid authentication token.");
      }
      return {
        sub,
        role,
        storeId: typeof payload.storeId === "string" ? payload.storeId : null,
        typ: "admin",
      };
    }
    if (typeof payload.storeId !== "string") {
      throw new UnauthorizedError("Invalid authentication token.");
    }
    return { sub, storeId: payload.storeId, typ: "customer" };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    throw new UnauthorizedError("Invalid or expired authentication token.");
  }
}

export function extractBearerToken(authorizationHeader?: string | null): string | null {
  if (!authorizationHeader) {
    return null;
  }
  const [scheme, token] = authorizationHeader.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token;
}
