import type { ErrorHandler } from "hono";
import { finalizeRequestDb } from "@/middleware/database";
import { AppError } from "@/shared/errors/app-error";
import { sendError } from "@/shared/response/error";
import { postgresErrorFields } from "@/shared/logging/postgres-error";
import { redactHeaders, safeErrorMessage } from "@/shared/logging/redact";
import type { AppEnv } from "@/shared/types/hono";

export const errorHandler: ErrorHandler<AppEnv> = (error, c) => {
  if (!(error instanceof AppError)) {
    const pg = postgresErrorFields(error);
    console.error("Unhandled error:", {
      requestId: c.get("requestId"),
      path: c.req.path,
      method: c.req.method,
      message: safeErrorMessage(error),
      code: pg.code,
      detail: pg.detail,
      hint: pg.hint,
      severity: pg.severity,
      causeMessage: pg.causeMessage,
      headers: redactHeaders(c.req.raw.headers),
    });
  }

  finalizeRequestDb(c);
  return sendError(c, error, c.get("requestId"));
};
