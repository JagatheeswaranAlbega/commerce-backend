const SENSITIVE_HEADER_NAMES = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-publishable-key",
]);

const SENSITIVE_BODY_KEYS = new Set([
  "password",
  "adminPassword",
  "refreshToken",
  "accessToken",
  "token",
  "rawKey",
  "publishableKey",
  "secretKey",
  "authorization",
]);

function redactString(value: string): string {
  if (/^Bearer\s+/i.test(value)) {
    return "Bearer [REDACTED]";
  }
  if (/^(pk_live_|sk_live_)/.test(value)) {
    return `${value.slice(0, 8)}…[REDACTED]`;
  }
  if (value.length > 24 && /^[A-Za-z0-9+/=._-]{24,}$/.test(value)) {
    return "[REDACTED]";
  }
  return value;
}

export function redactHeaders(
  headers: Headers | Record<string, string | undefined> | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;

  const entries: Array<[string, string]> =
    typeof (headers as Headers).forEach === "function" && !(headers instanceof Map)
      ? (() => {
          const list: Array<[string, string]> = [];
          (headers as Headers).forEach((value, name) => {
            list.push([name, value]);
          });
          return list;
        })()
      : Object.entries(headers as Record<string, string | undefined>).filter(
          (entry): entry is [string, string] => entry[1] != null,
        );

  for (const [name, value] of entries) {
    if (SENSITIVE_HEADER_NAMES.has(name.toLowerCase())) {
      out[name] = "[REDACTED]";
    } else {
      out[name] = redactString(value);
    }
  }
  return out;
}

export function redactValue(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map(redactValue);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_BODY_KEYS.has(key)) {
        out[key] = "[REDACTED]";
      } else {
        out[key] = redactValue(nested);
      }
    }
    return out;
  }
  return value;
}

export function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
