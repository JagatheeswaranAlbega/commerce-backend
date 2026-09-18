import { and, eq, isNull } from "drizzle-orm";
import type { Context, Next } from "hono";
import { users } from "@/db/schema/users";
import {
  ACCESS_TYPES,
  USER_ROLES,
  type RequestAuthContext,
} from "@/modules/auth/auth.types";
import { extractBearerToken, verifyAuthToken } from "@/modules/auth/jwt";
import { scheduleDbClose, useRequestDb } from "@/middleware/database";
import { AUTHORIZATION_HEADER } from "@/shared/constants/headers";
import { ForbiddenError, UnauthorizedError } from "@/shared/errors/app-error";
import type { AppEnv } from "@/shared/types/hono";

async function loadAdminAuth(c: Context<AppEnv>): Promise<RequestAuthContext> {
  const token = extractBearerToken(c.req.header(AUTHORIZATION_HEADER));
  if (!token) {
    throw new UnauthorizedError();
  }

  const payload = await verifyAuthToken(token, { secret: c.env?.JWT_SECRET });
  if (payload.typ !== "admin") {
    throw new UnauthorizedError("Admin authentication is required.");
  }

  const { db, opened } = await useRequestDb(c);
  if (opened) {
    scheduleDbClose(c, opened);
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, payload.sub),
  });

  if (!user || !user.isActive) {
    throw new UnauthorizedError("User is inactive or was not found.");
  }

  if (user.role !== payload.role) {
    throw new UnauthorizedError("Token role mismatch.");
  }

  if (user.role === USER_ROLES.STORE_ADMIN) {
    if (!user.storeId || user.storeId !== payload.storeId) {
      throw new ForbiddenError("Store scope mismatch.");
    }
    return {
      accessType: ACCESS_TYPES.STORE_ADMIN,
      userId: user.id,
      role: user.role,
      storeId: user.storeId,
      email: user.email,
    };
  }

  if (user.storeId !== null || payload.storeId !== null) {
    throw new ForbiddenError("Platform admin must not have a store scope.");
  }

  return {
    accessType: ACCESS_TYPES.PLATFORM_ADMIN,
    userId: user.id,
    role: user.role,
    storeId: null,
    email: user.email,
  };
}

export function requirePlatformAdmin() {
  return async (c: Context<AppEnv>, next: Next) => {
    const auth = await loadAdminAuth(c);
    if (auth.accessType !== ACCESS_TYPES.PLATFORM_ADMIN) {
      throw new ForbiddenError("Platform authorization is required.");
    }
    c.set("auth", auth);
    await next();
  };
}

export function requireStoreAdmin() {
  return async (c: Context<AppEnv>, next: Next) => {
    const auth = await loadAdminAuth(c);
    if (auth.accessType !== ACCESS_TYPES.STORE_ADMIN || !auth.storeId) {
      throw new ForbiddenError("Store admin authorization is required.");
    }
    c.set("auth", auth);
    await next();
  };
}

export function requireAdminAuth() {
  return async (c: Context<AppEnv>, next: Next) => {
    const auth = await loadAdminAuth(c);
    c.set("auth", auth);
    await next();
  };
}

export async function getOptionalAdminAuth(c: Context<AppEnv>): Promise<RequestAuthContext | null> {
  try {
    return await loadAdminAuth(c);
  } catch {
    return null;
  }
}

// silence unused import until used by optional helpers
void and;
void isNull;
