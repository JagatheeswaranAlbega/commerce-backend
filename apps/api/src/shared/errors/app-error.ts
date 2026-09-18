import { ERROR_CODES, type ErrorCode } from "@/shared/constants/error-codes";
import { ERROR_HTTP_STATUS, type HttpStatus } from "@/shared/constants/http";
import { ERROR_MESSAGES } from "@/shared/constants/messages";

type AppErrorOptions = {
  details?: unknown;
  status?: HttpStatus;
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: HttpStatus;
  readonly details: unknown;

  constructor(code: ErrorCode, message: string, options: AppErrorOptions = {}) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = options.status ?? ERROR_HTTP_STATUS[code];
    this.details = options.details ?? null;
  }

  toJSON() {
    return {
      status: "error" as const,
      message: this.message,
      errors: [
        {
          code: this.code,
          message: this.message,
          details: this.details,
        },
      ],
    };
  }
}

export class ValidationError extends AppError {
  constructor(message: string = ERROR_MESSAGES.VALIDATION_ERROR, details: unknown = null) {
    super(ERROR_CODES.VALIDATION_ERROR, message, { details });
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = ERROR_MESSAGES.UNAUTHORIZED, details: unknown = null) {
    super(ERROR_CODES.UNAUTHORIZED, message, { details });
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = ERROR_MESSAGES.FORBIDDEN, details: unknown = null) {
    super(ERROR_CODES.FORBIDDEN, message, { details });
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = ERROR_MESSAGES.NOT_FOUND, details: unknown = null) {
    super(ERROR_CODES.NOT_FOUND, message, { details });
    this.name = "NotFoundError";
  }
}

export class StoreNotFoundError extends AppError {
  constructor(message: string = ERROR_MESSAGES.STORE_NOT_FOUND, details: unknown = null) {
    super(ERROR_CODES.STORE_NOT_FOUND, message, { details });
    this.name = "StoreNotFoundError";
  }
}

export class StoreInactiveError extends AppError {
  constructor(message: string = ERROR_MESSAGES.STORE_INACTIVE, details: unknown = null) {
    super(ERROR_CODES.STORE_INACTIVE, message, { details });
    this.name = "StoreInactiveError";
  }
}

export class TenantAccessDeniedError extends AppError {
  constructor(message: string = ERROR_MESSAGES.TENANT_ACCESS_DENIED, details: unknown = null) {
    super(ERROR_CODES.TENANT_ACCESS_DENIED, message, { details });
    this.name = "TenantAccessDeniedError";
  }
}

export class InvalidApiKeyError extends AppError {
  constructor(message: string = ERROR_MESSAGES.INVALID_API_KEY, details: unknown = null) {
    super(ERROR_CODES.INVALID_API_KEY, message, { details });
    this.name = "InvalidApiKeyError";
  }
}

export class InvalidSecretKeyError extends AppError {
  constructor(message: string = ERROR_MESSAGES.INVALID_SECRET_KEY, details: unknown = null) {
    super(ERROR_CODES.INVALID_SECRET_KEY, message, { details });
    this.name = "InvalidSecretKeyError";
  }
}

export class DuplicateResourceError extends AppError {
  constructor(message: string = ERROR_MESSAGES.DUPLICATE_RESOURCE, details: unknown = null) {
    super(ERROR_CODES.DUPLICATE_RESOURCE, message, { details });
    this.name = "DuplicateResourceError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string = ERROR_MESSAGES.CONFLICT, details: unknown = null) {
    super(ERROR_CODES.CONFLICT, message, { details });
    this.name = "ConflictError";
  }
}

export class InsufficientStockError extends AppError {
  constructor(message: string = ERROR_MESSAGES.INSUFFICIENT_STOCK, details: unknown = null) {
    super(ERROR_CODES.INSUFFICIENT_STOCK, message, { details });
    this.name = "InsufficientStockError";
  }
}

export class InvalidStateError extends AppError {
  constructor(message: string = ERROR_MESSAGES.INVALID_STATE, details: unknown = null) {
    super(ERROR_CODES.INVALID_STATE, message, { details });
    this.name = "InvalidStateError";
  }
}

export class RateLimitedError extends AppError {
  constructor(message: string = ERROR_MESSAGES.RATE_LIMITED, details: unknown = null) {
    super(ERROR_CODES.RATE_LIMITED, message, { details });
    this.name = "RateLimitedError";
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = ERROR_MESSAGES.INTERNAL_ERROR, details: unknown = null) {
    super(ERROR_CODES.INTERNAL_ERROR, message, { details });
    this.name = "InternalServerError";
  }
}

export class GlobalResourceReadOnlyError extends ForbiddenError {
  constructor(message = "Global resource operations are not supported.") {
    super(message);
    this.name = "GlobalResourceReadOnlyError";
  }
}
