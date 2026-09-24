import type { Context, MiddlewareHandler, Next } from "hono";
import { openDb, type Database, type DatabaseHandle } from "@/db/client";
import type { AppEnv } from "@/shared/types/hono";

function endHandle(c: Context<AppEnv>, handle: DatabaseHandle) {
  try {
    c.executionCtx.waitUntil(handle.client.end({ timeout: 5 }));
  } catch {
    void handle.client.end({ timeout: 5 });
  }
}

/**
 * Close the request-scoped client only after the handler has finished.
 * Calling client.end() via waitUntil at open-time races in-flight queries
 * (CONNECTION_ENDED).
 */
export function scheduleDbClose(_c: Context<AppEnv>, _handle: DatabaseHandle) {
  // No-op: requestDbMiddleware (or finalizeRequestDb) owns lifecycle.
}

/** Close after the current handler work if middleware is not mounted. */
export function finalizeRequestDb(c: Context<AppEnv>) {
  const handle = c.get("dbHandle");
  if (handle) {
    endHandle(c, handle);
  }
}

/**
 * Opens a request-scoped DB when needed and always closes it after `next()`.
 */
export function requestDbMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c: Context<AppEnv>, next: Next) => {
    try {
      await next();
    } finally {
      finalizeRequestDb(c);
    }
  };
}

/**
 * Open a request-scoped database handle once and attach it to the Hono context.
 * Subsequent calls reuse the same handle for this request.
 */
export async function bindRequestDb(c: Context<AppEnv>): Promise<DatabaseHandle> {
  const existing = c.get("dbHandle");
  if (existing) {
    return existing;
  }

  const handle = await openDb(c.env.DATABASE_URL);
  c.set("db", handle.db);
  c.set("dbHandle", handle);
  return handle;
}

/** Prefer an already-bound request DB; otherwise open and return a closeable handle. */
export async function useRequestDb(
  c: Context<AppEnv>,
): Promise<{ db: Database; opened: DatabaseHandle | null }> {
  const existingDb = c.get("db");
  if (existingDb) {
    return { db: existingDb, opened: null };
  }

  const handle = await bindRequestDb(c);
  return { db: handle.db, opened: handle };
}
