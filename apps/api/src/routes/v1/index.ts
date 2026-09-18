import { Hono } from "hono";
import { API_BASE_PATH, API_VERSION, SERVICE_NAME } from "@/shared/constants/api";
import { SUCCESS_MESSAGES } from "@/shared/constants/success-messages";
import { getEnv } from "@/infrastructure/env/env";
import { createAuthRoutes } from "@/modules/auth/auth.routes";
import { createPlatformRoutes } from "@/routes/v1/platform";
import { createAdminRoutes } from "@/routes/v1/admin";
import { createStorefrontRoutes } from "@/routes/v1/storefront";
import { createS2sRoutes } from "@/routes/v1/s2s";
import { sendSuccess } from "@/shared/response/success";
import type { AppEnv } from "@/shared/types/hono";

export const healthRoutes = new Hono<AppEnv>();

healthRoutes.get("/", (c) => {
  const env = getEnv();
  return sendSuccess(
    c,
    {
      service: SERVICE_NAME,
      status: "ok",
      version: API_VERSION,
      environment: env.ENVIRONMENT,
    },
    { message: SUCCESS_MESSAGES.HEALTH_OK },
  );
});

export const rootRoutes = new Hono<AppEnv>();

rootRoutes.get("/", (c) => {
  return sendSuccess(
    c,
    {
      service: SERVICE_NAME,
      version: API_VERSION,
      basePath: API_BASE_PATH,
    },
    { message: SUCCESS_MESSAGES.REQUEST_COMPLETED },
  );
});

export type CreateV1RoutesOptions = Record<string, never>;

export function createV1Routes(_options: CreateV1RoutesOptions = {}) {
  const routes = new Hono<AppEnv>();

  routes.get("/", (c) => {
    return sendSuccess(
      c,
      {
        version: API_VERSION,
        basePath: API_BASE_PATH,
        surfaces: ["auth", "platform", "admin", "store", "s2s"],
      },
      { message: SUCCESS_MESSAGES.REQUEST_COMPLETED },
    );
  });

  routes.route("/health", healthRoutes);
  routes.route("/auth", createAuthRoutes());
  routes.route("/platform", createPlatformRoutes());
  routes.route("/admin", createAdminRoutes());
  routes.route("/store", createStorefrontRoutes());
  routes.route("/s2s", createS2sRoutes());

  return routes;
}

export const v1Routes = createV1Routes();
