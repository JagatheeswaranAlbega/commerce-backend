import type { ErrorHandler } from "hono";
import { finalizeRequestDb } from "@/middleware/database";
import { AppError } from "@/shared/errors/app-error";
import { sendError } from "@/shared/response/error";
import { redactHeaders, safeErrorMessage } from "@/shared/logging/redact";
import type { AppEnv } from "@/shared/types/hono";

export const errorHandler: ErrorHandler<AppEnv> = (error, c) => {
  if (!(error instanceof AppError)) {
    console.error("Unhandled error:", {
      requestId: c.get("requestId"),
      path: c.req.path,
      method: c.req.method,
      message: safeErrorMessage(error),
      headers: redactHeaders(c.req.raw.headers),
    });
  }

  finalizeRequestDb(c);
  return sendError(c, error, c.get("requestId"));
};
