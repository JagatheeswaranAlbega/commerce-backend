import { and, eq, isNull } from "drizzle-orm";
import type { Database } from "@/db/client";
import { refreshTokens } from "@/db/schema/refresh-tokens";
import { users } from "@/db/schema/users";
import { sha256Hex } from "@/infrastructure/crypto/api-key";
import { hashPassword, verifyPassword } from "@/infrastructure/crypto/password";
import { USER_ROLES, type AdminJwtPayload } from "@/modules/auth/auth.types";
import { signAuthToken } from "@/modules/auth/jwt";
import { UnauthorizedError, ValidationError } from "@/shared/errors/app-error";
import { postgresErrorFields } from "@/shared/logging/postgres-error";
import { normalizeEmail } from "@/shared/tenant/normalize";

const ACCESS_TTL_SECONDS = 60 * 60 * 24;
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30;

function toPublicUser(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    storeId: user.storeId,
  };
}

async function issueTokens(db: Database, user: typeof users.$inferSelect, jwtSecret: string) {
  const payload: AdminJwtPayload = {
    sub: user.id,
    role: user.role,
    storeId: user.storeId,
    typ: "admin",
  };
  const accessToken = await signAuthToken(payload, {
    secret: jwtSecret,
    expiresInSeconds: ACCESS_TTL_SECONDS,
  });

  const rawRefresh = `rt_${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
  const tokenHash = await sha256Hex(rawRefresh);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_SECONDS * 1000);

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  return {
    accessToken,
    refreshToken: rawRefresh,
    expiresIn: ACCESS_TTL_SECONDS,
    user: toPublicUser(user),
  };
}

export class AuthService {
  constructor(
    private readonly db: Database,
    private readonly jwtSecret: string,
  ) {}

  async login(email: string, password: string) {
    const normalized = normalizeEmail(email);
    let user: typeof users.$inferSelect | undefined;
    try {
      user = await this.db.query.users.findFirst({
        where: eq(users.email, normalized),
      });
    } catch (error) {
      const pg = postgresErrorFields(error);
      console.error("auth.login users query failed:", {
        message: pg.message,
        code: pg.code,
        detail: pg.detail,
        hint: pg.hint,
        severity: pg.severity,
        causeMessage: pg.causeMessage,
      });
      throw error;
    }

    if (!user || !user.isActive) {
      throw new UnauthorizedError("Invalid email or password.");
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError("Invalid email or password.");
    }

    if (user.role === USER_ROLES.STORE_ADMIN && !user.storeId) {
      throw new UnauthorizedError("Store admin is missing store scope.");
    }
    if (user.role === USER_ROLES.PLATFORM_SUPER_ADMIN && user.storeId) {
      throw new UnauthorizedError("Platform admin must not be store-scoped.");
    }

    return issueTokens(this.db, user, this.jwtSecret);
  }

  async me(userId: string) {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedError();
    }
    return toPublicUser(user);
  }

  async refresh(rawRefreshToken: string) {
    const tokenHash = await sha256Hex(rawRefreshToken);
    const existing = await this.db.query.refreshTokens.findFirst({
      where: and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)),
    });

    if (!existing || existing.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedError("Refresh token is invalid or expired.");
    }

    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(refreshTokens.id, existing.id));

    const user = await this.db.query.users.findFirst({
      where: eq(users.id, existing.userId),
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedError();
    }

    return issueTokens(this.db, user, this.jwtSecret);
  }

  async logout(rawRefreshToken?: string) {
    if (!rawRefreshToken) {
      return { loggedOut: true as const };
    }
    const tokenHash = await sha256Hex(rawRefreshToken);
    const existing = await this.db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.tokenHash, tokenHash),
    });
    if (existing && !existing.revokedAt) {
      await this.db
        .update(refreshTokens)
        .set({ revokedAt: new Date(), updatedAt: new Date() })
        .where(eq(refreshTokens.id, existing.id));
    }
    return { loggedOut: true as const };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedError();
    }

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError("Current password is incorrect.");
    }

    if (currentPassword === newPassword) {
      throw new ValidationError("New password must be different from the current password.");
    }

    const passwordHash = await hashPassword(newPassword);
    await this.db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, userId));

    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));

    return { changed: true as const };
  }
}
