import { cn } from "cn"

import type { ProductStatus } from "@/lib/api/admin/products"

const STATUS_LABEL: Record<ProductStatus, string> = {
  ACTIVE: "Published",
  DRAFT: "Draft",
  ARCHIVED: "Archived",
}

const STATUS_DOT: Record<ProductStatus, string> = {
  ACTIVE: "bg-emerald-500",
  DRAFT: "bg-amber-500",
  ARCHIVED: "bg-zinc-400",
}

export function ProductStatusBadge({
  status,
  className,
}: {
  status: ProductStatus
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm text-foreground",
        className
      )}
    >
      <span
        aria-hidden
        className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[status])}
      />
      {STATUS_LABEL[status]}
    </span>
  )
}
