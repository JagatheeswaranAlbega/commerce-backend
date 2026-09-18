import type { Context } from "hono";
import { Hono } from "hono";
import { AuthService } from "@/modules/auth/auth.service";
import {
  changePasswordBodySchema,
  loginBodySchema,
  refreshBodySchema,
} from "@/modules/auth/auth.schemas";
import { requireAdminAuth } from "@/middleware/require-admin";
import { scheduleDbClose, useRequestDb } from "@/middleware/database";
import { authRateLimit } from "@/middleware/rate-limit";
import { sendSuccess } from "@/shared/response";
import { SUCCESS_MESSAGES } from "@/shared/constants/success-messages";
import { ValidationError } from "@/shared/errors/app-error";
import type { AppEnv } from "@/shared/types/hono";

function getJwtSecret(c: Context<AppEnv>): string {
  return c.env?.JWT_SECRET || process.env.JWT_SECRET || "";
}

export function createAuthRoutes() {
  const app = new Hono<AppEnv>();

  app.post("/login", authRateLimit(), async (c) => {
    const parsed = loginBodySchema.safeParse(await c.req.json());
    if (!parsed.success) {
      throw new ValidationError("Invalid login payload.", parsed.error.flatten());
    }

    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);

    const service = new AuthService(db, getJwtSecret(c));
    const data = await service.login(parsed.data.email, parsed.data.password);
    return sendSuccess(c, data, { message: SUCCESS_MESSAGES.LOGGED_IN });
  });

  app.post("/refresh", authRateLimit(), async (c) => {
    const parsed = refreshBodySchema.safeParse(await c.req.json());
    if (!parsed.success) {
      throw new ValidationError("Invalid refresh payload.", parsed.error.flatten());
    }

    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);

    const service = new AuthService(db, getJwtSecret(c));
    const data = await service.refresh(parsed.data.refreshToken);
    return sendSuccess(c, data, { message: SUCCESS_MESSAGES.TOKEN_REFRESHED });
  });

  app.post("/logout", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const refreshToken =
      typeof body === "object" && body && "refreshToken" in body
        ? String((body as { refreshToken?: string }).refreshToken ?? "")
        : "";

    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);

    const service = new AuthService(db, getJwtSecret(c));
    const data = await service.logout(refreshToken || undefined);
    return sendSuccess(c, data, { message: SUCCESS_MESSAGES.LOGGED_OUT });
  });

  app.get("/me", requireAdminAuth(), async (c) => {
    const auth = c.get("auth");
    if (!auth?.userId) {
      throw new ValidationError("Missing authenticated user.");
    }

    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);

    const service = new AuthService(db, getJwtSecret(c));
    const data = await service.me(auth.userId);
    return sendSuccess(c, data, { message: SUCCESS_MESSAGES.USER_RETRIEVED });
  });

  app.post("/change-password", requireAdminAuth(), authRateLimit(), async (c) => {
    const auth = c.get("auth");
    if (!auth?.userId) {
      throw new ValidationError("Missing authenticated user.");
    }

    const parsed = changePasswordBodySchema.safeParse(await c.req.json());
    if (!parsed.success) {
      throw new ValidationError("Invalid change password payload.", parsed.error.flatten());
    }

    const { db, opened } = await useRequestDb(c);
    if (opened) scheduleDbClose(c, opened);

    const service = new AuthService(db, getJwtSecret(c));
    const data = await service.changePassword(
      auth.userId,
      parsed.data.currentPassword,
      parsed.data.newPassword,
    );
    return sendSuccess(c, data, { message: SUCCESS_MESSAGES.PASSWORD_CHANGED });
  });

  return app;
}
