import { Skeleton } from "@/components/ui/skeleton"

type DataTableSkeletonProps = {
  columns?: number
  rows?: number
}

export function DataTableSkeleton({
  columns = 4,
  rows = 6,
}: DataTableSkeletonProps) {
  return (
    <div className="admin-panel">
      <div className="border-b border-border/70 bg-muted/40 px-3.5 py-3">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, index) => (
            <Skeleton key={index} className="h-3.5 w-20" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-border/70">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex gap-4 px-3.5 py-3.5">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton
                key={colIndex}
                className="h-4 flex-1"
                style={{ maxWidth: colIndex === 0 ? 180 : 120 }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
