"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { DataTable, type AppColumnDef } from "@/components/data-table"
import { DataTableSkeleton } from "@/components/admin/data-table-skeleton"
import {
  AdminFilterBar,
  AdminFilterSearch,
  AdminFilterSelect,
} from "@/components/admin/admin-filter-bar"
import { AdminPageHeader } from "@/components/admin/page-header"
import {
  PlatformStoreFilter,
  usePlatformStoreFilter,
} from "@/components/admin/platform-store-filter"
import { ListPagination } from "@/components/list-pagination"
import { Badge } from "@/components/ui/badge"
import {
  listPlatformOrders,
  type PlatformOrder,
} from "@/lib/api/platform/orders"
import { listPlatformStores } from "@/lib/api/platform/stores"
import { ADMIN_TABLE_PAGE_SIZE } from "@/lib/admin-table"
import { formatDate } from "@/lib/format"
import { formatPaise } from "@/lib/money"

const STATUS_OPTIONS = [
  { value: "ALL", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "PROCESSING", label: "Processing" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "REFUNDED", label: "Returned (restocked)" },
]

export function PlatformOrders() {
  const { storeId, setStoreId } = usePlatformStoreFilter()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [search, setSearch] = useState("")

  const storesQuery = useQuery({
    queryKey: ["platform", "stores"],
    queryFn: () => listPlatformStores({ pageSize: 100 }),
  })

  const ordersQuery = useQuery({
    queryKey: ["platform", "orders", page, storeId, statusFilter, search],
    queryFn: () =>
      listPlatformOrders({
        page,
        pageSize: ADMIN_TABLE_PAGE_SIZE,
        storeId: storeId || undefined,
        status: statusFilter === "ALL" ? undefined : statusFilter,
        q: search.trim() || undefined,
      }),
  })

  const columns = useMemo<AppColumnDef<PlatformOrder>[]>(
    () => [
      {
        accessorKey: "orderNumber",
        header: "Order",
        cell: ({ row }) => (
          <Link
            href={`/admin/orders/${row.original.id}`}
            className="font-medium underline-offset-4 hover:underline"
          >
            {row.original.orderNumber}
          </Link>
        ),
      },
      {
        accessorKey: "storeName",
        header: "Store",
        cell: ({ row }) =>
          row.original.storeName ??
          storesQuery.data?.data.find((s) => s.id === row.original.storeId)
            ?.name ??
          row.original.storeId,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant="secondary">
            {row.original.status === "REFUNDED"
              ? "Returned (restocked)"
              : row.original.status}
          </Badge>
        ),
      },
      {
        id: "email",
        header: "Email",
        cell: ({ row }) => row.original.email?.trim() || "—",
      },
      {
        accessorKey: "grandTotalPaise",
        header: "Total",
        cell: ({ row }) => formatPaise(row.original.grandTotalPaise),
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        sortFn: "datetime",
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        sortFn: "datetime",
        cell: ({ row }) =>
          row.original.updatedAt ? formatDate(row.original.updatedAt) : "—",
      },
    ],
    [storesQuery.data?.data]
  )

  const filtered = ordersQuery.data?.data ?? []

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Orders"
        description="Orders across all stores"
        breadcrumbs={[{ label: "Orders" }]}
      />

      <AdminFilterBar
        dirty={
          storeId !== "" || statusFilter !== "ALL" || search.trim() !== ""
        }
        onClear={() => {
          setStoreId("")
          setStatusFilter("ALL")
          setSearch("")
          setPage(1)
        }}
        end={
          <AdminFilterSearch
            value={search}
            onChange={(value) => {
              setSearch(value)
              setPage(1)
            }}
            placeholder="Search order number or email…"
          />
        }
      >
        <PlatformStoreFilter
          value={storeId}
          onChange={(next) => {
            setStoreId(next)
            setPage(1)
          }}
        />
        <AdminFilterSelect
          id="platform-order-status"
          label="Status"
          value={statusFilter}
          onChange={(value) => {
            setStatusFilter(value)
            setPage(1)
          }}
          options={STATUS_OPTIONS}
        />
      </AdminFilterBar>

      {ordersQuery.isError ? (
        <p className="text-sm text-destructive">
          {ordersQuery.error instanceof Error
            ? ordersQuery.error.message
            : "Failed to load orders."}
        </p>
      ) : null}

      {ordersQuery.isLoading ? (
        <DataTableSkeleton columns={6} rows={8} />
      ) : (
        <>
          <DataTable
              columns={columns}
              data={filtered}
              paginate={false}
              emptyMessage="No orders found for this filter."
            />
          <ListPagination
            pagination={ordersQuery.data?.pagination}
            onPageChange={setPage}
            disabled={ordersQuery.isFetching}
          />
        </>
      )}
    </div>
  )
}
