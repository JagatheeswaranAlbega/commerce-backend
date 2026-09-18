import { REQUEST_ID_HEADER } from "@/shared/constants/headers";

export function getOrCreateRequestId(request: Request): string {
  const existing = request.headers.get(REQUEST_ID_HEADER)?.trim();

  if (existing) {
    return existing;
  }

  return crypto.randomUUID();
}

export function withRequestIdHeader(requestId: string): Record<string, string> {
  return { [REQUEST_ID_HEADER]: requestId };
}
