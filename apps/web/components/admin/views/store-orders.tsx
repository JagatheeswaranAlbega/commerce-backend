"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { DataTableSkeleton } from "@/components/admin/data-table-skeleton"
import {
  AdminFilterBar,
  AdminFilterSearch,
  AdminFilterSelect,
} from "@/components/admin/admin-filter-bar"
import { AdminPageHeader } from "@/components/admin/page-header"
import { DataTable, type AppColumnDef } from "@/components/data-table"
import { ListPagination } from "@/components/list-pagination"
import { RowActionsMenu } from "@/components/row-actions-menu"
import { Badge } from "@/components/ui/badge"
import {
  listAdminOrders,
  updateAdminOrder,
  type AdminOrder,
  type OrderStatus,
} from "@/lib/api/admin/orders"
import { ADMIN_TABLE_PAGE_SIZE } from "@/lib/admin-table"
import { formatDate } from "@/lib/format"
import { formatPaise } from "@/lib/money"

const STATUS_OPTIONS: Array<{ value: OrderStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "PROCESSING", label: "Processing" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "REFUNDED", label: "Returned (restocked)" },
]

export function StoreOrders() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<OrderStatus | "ALL">("ALL")
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [pendingStatus, setPendingStatus] = useState<{
    order: AdminOrder
    nextStatus: OrderStatus
  } | null>(null)

  const ordersQuery = useQuery({
    queryKey: ["admin", "orders", status, page, search],
    queryFn: () =>
      listAdminOrders({
        page,
        pageSize: ADMIN_TABLE_PAGE_SIZE,
        status: status === "ALL" ? undefined : status,
        q: search.trim() || undefined,
      }),
  })

  const updateMutation = useMutation({
    mutationFn: ({
      orderId,
      nextStatus,
    }: {
      orderId: string
      nextStatus: OrderStatus
    }) => updateAdminOrder(orderId, { status: nextStatus }),
    onSuccess: async () => {
      setPendingStatus(null)
      await queryClient.invalidateQueries({ queryKey: ["admin", "orders"] })
    },
  })

  const filtered = ordersQuery.data?.data ?? []

  const columns = useMemo<AppColumnDef<AdminOrder>[]>(
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
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const current = row.original.status
          const next: OrderStatus | null =
            current === "PENDING"
              ? "PROCESSING"
              : current === "PROCESSING"
                ? "SHIPPED"
                : current === "SHIPPED"
                  ? "DELIVERED"
                  : null

          const items = [
            {
              label: "View",
              onClick: () => router.push(`/admin/orders/${row.original.id}`),
            },
          ]
          if (next) {
            items.push({
              label: `Mark ${next.toLowerCase()}`,
              onClick: () =>
                setPendingStatus({
                  order: row.original,
                  nextStatus: next,
                }),
            })
          }

          return <RowActionsMenu label="Order actions" items={items} />
        },
      },
    ],
    [router]
  )

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Orders"
        description="Fulfill and track orders for this store"
        breadcrumbs={[{ label: "Orders" }]}
      />

      <AdminFilterBar
        dirty={status !== "ALL" || search.trim() !== ""}
        onClear={() => {
          setStatus("ALL")
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
        <AdminFilterSelect
          id="order-status-filter"
          label="Status"
          value={status}
          onChange={(value) => {
            setStatus(value as OrderStatus | "ALL")
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
              emptyMessage={
                search.trim()
                  ? "No orders match your search."
                  : "No orders found."
              }
            />
          <ListPagination
            pagination={ordersQuery.data?.pagination}
            onPageChange={setPage}
            disabled={ordersQuery.isFetching}
          />
        </>
      )}

      <ConfirmDialog
        open={Boolean(pendingStatus)}
        onOpenChange={(open) => {
          if (!open) setPendingStatus(null)
        }}
        title="Update order status?"
        description={
          pendingStatus
            ? `Mark order ${pendingStatus.order.orderNumber} as ${pendingStatus.nextStatus}?`
            : ""
        }
        confirmLabel={`Mark ${pendingStatus?.nextStatus.toLowerCase() ?? "updated"}`}
        pending={updateMutation.isPending}
        onConfirm={() => {
          if (!pendingStatus) return
          updateMutation.mutate({
            orderId: pendingStatus.order.id,
            nextStatus: pendingStatus.nextStatus,
          })
        }}
      />
    </div>
  )
}
