import { z, type ZodType } from "zod";
import { ValidationError } from "@/shared/errors/app-error";
import { validationIssuesFromZod } from "@/shared/errors/from-unknown";
import { ERROR_MESSAGES } from "@/shared/constants/messages";

export function parseWithSchema<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new ValidationError(ERROR_MESSAGES.VALIDATION_ERROR, validationIssuesFromZod(result.error));
  }

  return result.data;
}

export function parseSearchParams<T>(schema: ZodType<T>, request: Request): T {
  const url = new URL(request.url);
  const raw: Record<string, string> = {};

  url.searchParams.forEach((value, key) => {
    raw[key] = value;
  });

  return parseWithSchema(schema, raw);
}

export { z };
