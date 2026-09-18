import { createMiddleware } from "hono/factory";
import { getOrCreateRequestId } from "@/shared/response/request-id";
import { REQUEST_ID_HEADER } from "@/shared/constants/headers";
import type { AppEnv } from "@/shared/types/hono";

export const requestIdMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const requestId = getOrCreateRequestId(c.req.raw);
  c.set("requestId", requestId);
  await next();
  c.header(REQUEST_ID_HEADER, requestId);
});
