import { Hono } from "hono";
import { cors } from "hono/cors";
import { errorHandler } from "@/middleware/error-handler";
import { requestDbMiddleware } from "@/middleware/database";
import { requestIdMiddleware } from "@/middleware/request-id";
import { secureHeadersMiddleware } from "@/middleware/secure-headers";
import { createV1Routes, rootRoutes, type CreateV1RoutesOptions } from "@/routes/v1";
import { API_BASE_PATH } from "@/shared/constants/api";
import type { AppEnv } from "@/shared/types/hono";

export type CreateAppOptions = CreateV1RoutesOptions;

export function createApp(options: CreateAppOptions = {}) {
  const app = new Hono<AppEnv>();

  app.use("*", requestIdMiddleware);
  app.use("*", secureHeadersMiddleware());
  app.use(
    "*",
    cors({
      origin: "*",
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "X-Request-Id",
        "x-publishable-key",
        "Idempotency-Key",
      ],
      exposeHeaders: ["X-Request-Id"],
    }),
  );
  app.use("*", requestDbMiddleware());

  app.onError(errorHandler);

  app.route("/", rootRoutes);
  app.route(API_BASE_PATH, createV1Routes(options));

  app.notFound((c) => {
    return c.json(
      {
        status: "error",
        message: "The requested resource was not found.",
        errors: [
          {
            code: "NOT_FOUND",
            message: "The requested resource was not found.",
          },
        ],
      },
      404,
    );
  });

  return app;
}

export type App = ReturnType<typeof createApp>;
