import type { ErrorCode } from "@/shared/constants/error-codes";
import type { PaginationMeta } from "@/shared/types/pagination";

export type ApiErrorDetails = unknown;

export type ApiErrorItem = {
  code: ErrorCode;
  message?: string;
  details?: ApiErrorDetails;
};

export type ApiSuccessResponse<T> = {
  status: "success";
  message: string;
  data: T;
  pagination?: PaginationMeta;
};

export type ApiErrorResponse = {
  status: "error";
  message: string;
  errors?: ApiErrorItem[];
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
