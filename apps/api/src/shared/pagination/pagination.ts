import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/shared/constants/pagination";
import type { PaginationMeta, PaginationQuery } from "@/shared/types/pagination";

export function normalizePagination(input: Partial<PaginationQuery> = {}): PaginationQuery {
  const page = Number.isInteger(input.page) && (input.page ?? 0) >= 1 ? (input.page as number) : DEFAULT_PAGE;
  const requestedSize =
    Number.isInteger(input.pageSize) && (input.pageSize ?? 0) >= 1
      ? (input.pageSize as number)
      : DEFAULT_PAGE_SIZE;

  return {
    page,
    pageSize: Math.min(requestedSize, MAX_PAGE_SIZE),
  };
}

export function paginationOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}

export function buildPaginationMeta(page: number, pageSize: number, total: number): PaginationMeta {
  const safeTotal = Math.max(0, total);

  return {
    page,
    pageSize,
    total: safeTotal,
    totalPages: safeTotal === 0 ? 0 : Math.ceil(safeTotal / pageSize),
  };
}
