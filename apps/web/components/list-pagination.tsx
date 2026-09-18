"use client"

import { Button } from "@/components/ui/button"
import type { PaginationMeta } from "@/lib/api"

export function ListPagination({
  pagination,
  onPageChange,
  disabled,
}: {
  pagination?: PaginationMeta
  onPageChange: (page: number) => void
  disabled?: boolean
}) {
  if (!pagination || pagination.totalPages <= 1) return null

  const { page, totalPages, total } = pagination

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/50 px-3 py-2.5 sm:px-4">
      <p className="text-sm text-muted-foreground">
        Page <span className="font-medium text-foreground">{page}</span> of{" "}
        <span className="font-medium text-foreground">{totalPages}</span>
        <span className="text-muted-foreground/70"> · {total} total</span>
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
