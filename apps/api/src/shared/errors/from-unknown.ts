import { ERROR_CODES } from "@/shared/constants/error-codes";
import { ERROR_MESSAGES } from "@/shared/constants/messages";
import { AppError, InternalServerError, ValidationError } from "@/shared/errors/app-error";
import { ZodError } from "zod";

export type ValidationIssue = {
  path: string;
  message: string;
};

export function validationIssuesFromZod(error: ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.map(String).join(".") : "",
    message: issue.message,
  }));
}

export function errorFromUnknown(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ZodError) {
    return new ValidationError(ERROR_MESSAGES.VALIDATION_ERROR, validationIssuesFromZod(error));
  }

  return new InternalServerError();
}

export function isInternalError(error: AppError): boolean {
  return error.code === ERROR_CODES.INTERNAL_ERROR;
}
