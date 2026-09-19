/**
 * Extract PostgreSQL / Drizzle driver error fields for diagnostics.
 * Drizzle wraps driver errors as `Failed query: ...` with details on `cause`.
 */
export function postgresErrorFields(error: unknown): {
  message?: string;
  code?: string;
  detail?: string;
  hint?: string;
  severity?: string;
  causeMessage?: string;
} {
  if (!error || typeof error !== "object") {
    return { message: String(error) };
  }

  const top = error as Record<string, unknown>;
  const cause =
    top.cause && typeof top.cause === "object"
      ? (top.cause as Record<string, unknown>)
      : null;

  const pickString = (...values: unknown[]): string | undefined => {
    for (const value of values) {
      if (typeof value === "string" && value.length > 0) return value;
    }
    return undefined;
  };

  return {
    message: pickString(top.message),
    code: pickString(cause?.code, top.code),
    detail: pickString(cause?.detail, top.detail),
    hint: pickString(cause?.hint, top.hint),
    severity: pickString(cause?.severity, top.severity),
    causeMessage: pickString(cause?.message),
  };
}
