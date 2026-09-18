import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { HTTP_STATUS } from "@/shared/constants/http";
import { REQUEST_ID_HEADER } from "@/shared/constants/headers";
import type { ApiSuccessResponse } from "@/shared/types/api";
import type { PaginationMeta } from "@/shared/types/pagination";
import type { AppEnv } from "@/shared/types/hono";

type SuccessOptions = {
  message: string;
  status?: ContentfulStatusCode;
  requestId?: string;
  pagination?: PaginationMeta;
};

export function successResponse<T>(data: T, options: SuccessOptions) {
  const status = options.status ?? HTTP_STATUS.OK;
  const body: ApiSuccessResponse<T> = {
    status: "success",
    message: options.message,
    data,
  };

  if (options.pagination) {
    body.pagination = options.pagination;
  }

  const headers: Record<string, string> = {};
  if (options.requestId) {
    headers[REQUEST_ID_HEADER] = options.requestId;
  }

  return Response.json(body, { status, headers });
}

export function createdResponse<T>(
  data: T,
  options: Omit<SuccessOptions, "status"> & { message: string },
) {
  return successResponse(data, { ...options, status: HTTP_STATUS.CREATED });
}

export function noContentResponse(requestId?: string) {
  const headers: Record<string, string> = {};
  if (requestId) {
    headers[REQUEST_ID_HEADER] = requestId;
  }

  return new Response(null, { status: HTTP_STATUS.NO_CONTENT, headers });
}

export function sendSuccess<T>(c: Context<AppEnv>, data: T, options: SuccessOptions) {
  const status = (options.status ?? HTTP_STATUS.OK) as ContentfulStatusCode;
  const requestId = options.requestId ?? c.get("requestId");
  const body: ApiSuccessResponse<T> = {
    status: "success",
    message: options.message,
    data,
  };

  if (options.pagination) {
    body.pagination = options.pagination;
  }

  if (requestId) {
    c.header(REQUEST_ID_HEADER, requestId);
  }

  return c.json(body, status);
}

export function sendNoContent(c: Context<AppEnv>) {
  const requestId = c.get("requestId");
  if (requestId) {
    c.header(REQUEST_ID_HEADER, requestId);
  }

  return c.body(null, HTTP_STATUS.NO_CONTENT);
}
