import { and, eq } from "drizzle-orm";
import type { Context, Next } from "hono";
import { apiKeys } from "@/db/schema/api-keys";
import { stores } from "@/db/schema/stores";
import { ACCESS_TYPES } from "@/modules/auth/auth.types";
import { scheduleDbClose, useRequestDb } from "@/middleware/database";
import {
  AUTHORIZATION_HEADER,
  PUBLISHABLE_KEY_HEADER,
} from "@/shared/constants/headers";
import { sha256Hex } from "@/infrastructure/crypto/api-key";
import {
  InvalidApiKeyError,
  InvalidSecretKeyError,
  StoreInactiveError,
  StoreNotFoundError,
} from "@/shared/errors/app-error";
import type { AppEnv } from "@/shared/types/hono";

async function resolveStoreByKeyHash(
  c: Context<AppEnv>,
  secretHash: string,
  type: "PUBLISHABLE" | "SECRET",
) {
  const { db, opened } = await useRequestDb(c);
  if (opened) {
    scheduleDbClose(c, opened);
  }

  const key = await db.query.apiKeys.findFirst({
    where: and(
      eq(apiKeys.secretHash, secretHash),
      eq(apiKeys.type, type),
      eq(apiKeys.status, "ACTIVE"),
    ),
  });

  if (!key) {
    return null;
  }

  const store = await db.query.stores.findFirst({
    where: eq(stores.id, key.storeId),
  });

  if (!store) {
    throw new StoreNotFoundError();
  }
  if (store.status !== "ACTIVE") {
    throw new StoreInactiveError();
  }

  return { store, key };
}

export function requirePublishableKey() {
  return async (c: Context<AppEnv>, next: Next) => {
    const rawKey = c.req.header(PUBLISHABLE_KEY_HEADER)?.trim();
    if (!rawKey || !rawKey.startsWith("pk_live_")) {
      throw new InvalidApiKeyError();
    }

    const secretHash = await sha256Hex(rawKey);
    const resolved = await resolveStoreByKeyHash(c, secretHash, "PUBLISHABLE");
    if (!resolved) {
      throw new InvalidApiKeyError();
    }

    c.set("auth", {
      accessType: ACCESS_TYPES.STOREFRONT,
      storeId: resolved.store.id,
      apiKeyId: resolved.key.id,
    });
    await next();
  };
}

export function requireSecretKey() {
  return async (c: Context<AppEnv>, next: Next) => {
    const header = c.req.header(AUTHORIZATION_HEADER);
    const token = header?.toLowerCase().startsWith("bearer ")
      ? header.slice(7).trim()
      : null;
    if (!token || !token.startsWith("sk_live_")) {
      throw new InvalidSecretKeyError();
    }

    const secretHash = await sha256Hex(token);
    const resolved = await resolveStoreByKeyHash(c, secretHash, "SECRET");
    if (!resolved) {
      throw new InvalidSecretKeyError();
    }

    c.set("auth", {
      accessType: ACCESS_TYPES.SECRET_KEY,
      storeId: resolved.store.id,
      apiKeyId: resolved.key.id,
    });
    await next();
  };
}
