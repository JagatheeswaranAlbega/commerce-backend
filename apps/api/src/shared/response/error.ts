import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ERROR_MESSAGES } from "@/shared/constants/messages";
import { REQUEST_ID_HEADER } from "@/shared/constants/headers";
import { errorFromUnknown, isInternalError } from "@/shared/errors/from-unknown";
import type { ApiErrorItem, ApiErrorResponse } from "@/shared/types/api";
import type { AppEnv } from "@/shared/types/hono";

function buildErrorBody(error: unknown): ApiErrorResponse {
  const appError = errorFromUnknown(error);
  const clientMessage = isInternalError(appError)
    ? ERROR_MESSAGES.INTERNAL_ERROR
    : appError.message;

  const body: ApiErrorResponse = {
    status: "error",
    message: clientMessage,
  };

  if (!isInternalError(appError)) {
    const item: ApiErrorItem = {
      code: appError.code,
      message: clientMessage,
    };
    if (appError.details != null) {
      item.details = appError.details;
    }
    body.errors = [item];
  }

  return body;
}

export function errorResponse(error: unknown, requestId?: string) {
  const appError = errorFromUnknown(error);
  const body = buildErrorBody(error);

  const headers: Record<string, string> = {};
  if (requestId) {
    headers[REQUEST_ID_HEADER] = requestId;
  }

  return Response.json(body, { status: appError.status, headers });
}

export function sendError(c: Context<AppEnv>, error: unknown, requestId?: string) {
  const appError = errorFromUnknown(error);
  const resolvedRequestId = requestId ?? c.get("requestId");
  const body = buildErrorBody(error);

  if (resolvedRequestId) {
    c.header(REQUEST_ID_HEADER, resolvedRequestId);
  }

  return c.json(body, appError.status as ContentfulStatusCode);
}
