"use client"

import type { ReactNode } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import {
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
} from "@tanstack/react-table"
import { cn } from "cn"

import { ListPagination } from "@/components/list-pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ADMIN_TABLE_PAGE_SIZE } from "@/lib/admin-table"

const features = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
})

export type AppColumnDef<TData extends RowData> = ColumnDef<
  typeof features,
  TData,
  unknown
>

type DataTableProps<TData extends RowData> = {
  columns: AppColumnDef<TData>[]
  data: TData[]
  emptyMessage?: ReactNode
  /** Client-side page size. Ignored when `paginate` is false. */
  pageSize?: number
  /**
   * When true (default), sort + paginate the provided rows in the table.
   * Set false for server-paginated lists that already return one page.
   */
  paginate?: boolean
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  emptyMessage = "No results.",
  pageSize = ADMIN_TABLE_PAGE_SIZE,
  paginate = true,
}: DataTableProps<TData>) {
  const table = useTable(
    {
      features,
      columns,
      data,
      enableSortingRemoval: true,
      autoResetPageIndex: true,
      manualPagination: !paginate,
      initialState: {
        pagination: {
          pageIndex: 0,
          pageSize: paginate ? pageSize : Number.POSITIVE_INFINITY,
        },
      },
    },
    (state) => ({
      pagination: state.pagination,
      sorting: state.sorting,
    })
  )

  const pageCount = paginate ? table.getPageCount() : 1
  const pageIndex = table.state.pagination.pageIndex
  const total = table.getRowCount()

  return (
    <div className="flex flex-col gap-3">
      <div className="admin-panel w-full overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        type="button"
                        className={cn(
                          "-ml-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 font-medium transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
                          header.column.getIsSorted() && "text-foreground"
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <table.FlexRender header={header} />
                        {header.column.getIsSorted() === "asc" ? (
                          <ArrowUp
                            className="size-3.5 shrink-0 opacity-70"
                            aria-hidden
                          />
                        ) : header.column.getIsSorted() === "desc" ? (
                          <ArrowDown
                            className="size-3.5 shrink-0 opacity-70"
                            aria-hidden
                          />
                        ) : (
                          <ArrowUpDown
                            className="size-3.5 shrink-0 opacity-40"
                            aria-hidden
                          />
                        )}
                      </button>
                    ) : (
                      <table.FlexRender header={header} />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="h-28 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {paginate && pageCount > 1 ? (
        <ListPagination
          pagination={{
            page: pageIndex + 1,
            pageSize,
            total,
            totalPages: pageCount,
          }}
          onPageChange={(page) => table.setPageIndex(page - 1)}
        />
      ) : null}
    </div>
  )
}
