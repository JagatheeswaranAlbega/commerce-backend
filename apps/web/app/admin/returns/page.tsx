"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  AdminFilterBar,
  AdminFilterSelect,
} from "@/components/admin/admin-filter-bar"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { DataTableSkeleton } from "@/components/admin/data-table-skeleton"
import { AdminPageHeader } from "@/components/admin/page-header"
import { PermissionGate } from "@/components/admin/permission-gate"
import { RoleSwitch } from "@/components/admin/role-switch"
import { DataTable, type AppColumnDef } from "@/components/data-table"
import { ListPagination } from "@/components/list-pagination"
import { RowActionsMenu } from "@/components/row-actions-menu"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ApiError } from "@/lib/api"
import { ADMIN_TABLE_PAGE_SIZE } from "@/lib/admin-table"
import {
  approveAdminReturn,
  listAdminReturns,
  rejectAdminReturn,
  type AdminOrderReturn,
  type OrderReturnStatus,
} from "@/lib/api/admin/returns"
import { formatDate } from "@/lib/format"
import { formatPaise } from "@/lib/money"

export default function AdminReturnsPage() {
  return (
    <PermissionGate permission="orders.read">
      <RoleSwitch
        platform={<PlatformReturnsNotice />}
        store={<StoreReturnsPage />}
      />
    </PermissionGate>
  )
}

function PlatformReturnsNotice() {
  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader
        title="Returns"
        description="Returns are managed by each store admin."
      />
      <p className="text-sm text-muted-foreground">
        Open a store admin session to approve or reject return requests.
      </p>
    </div>
  )
}

function StoreReturnsPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<"ALL" | OrderReturnStatus>(
    "ALL"
  )
  const [approveId, setApproveId] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<AdminOrderReturn | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [error, setError] = useState<string | null>(null)

  const returnsQuery = useQuery({
    queryKey: ["admin", "returns", page, statusFilter],
    queryFn: () =>
      listAdminReturns({
        page,
        pageSize: ADMIN_TABLE_PAGE_SIZE,
        status: statusFilter === "ALL" ? undefined : statusFilter,
      }),
  })

  const approveMutation = useMutation({
    mutationFn: (returnId: string) => approveAdminReturn(returnId),
    onSuccess: async () => {
      setApproveId(null)
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ["admin", "returns"] })
      await queryClient.invalidateQueries({ queryKey: ["admin", "orders"] })
    },
    onError: (cause) => {
      setError(
        cause instanceof ApiError ? cause.message : "Failed to approve return."
      )
    },
  })

  const rejectMutation = useMutation({
    mutationFn: () =>
      rejectAdminReturn(rejectTarget!.id, {
        reason: rejectReason.trim() || undefined,
      }),
    onSuccess: async () => {
      setRejectTarget(null)
      setRejectReason("")
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ["admin", "returns"] })
    },
    onError: (cause) => {
      setError(
        cause instanceof ApiError ? cause.message : "Failed to reject return."
      )
    },
  })

  const columns = useMemo<AppColumnDef<AdminOrderReturn>[]>(
    () => [
      {
        id: "order",
        header: "Order",
        cell: ({ row }) => (
          <Link
            href={`/admin/orders/${row.original.orderId}`}
            className="font-medium underline-offset-4 hover:underline"
          >
            {row.original.order?.orderNumber ?? row.original.orderId}
          </Link>
        ),
      },
      {
        id: "customer",
        header: "Customer",
        cell: ({ row }) =>
          row.original.customer?.email ??
          row.original.customer?.name ??
          "—",
      },
      {
        accessorKey: "reason",
        header: "Reason",
        cell: ({ row }) => (
          <span className="line-clamp-2 max-w-xs text-sm">
            {row.original.reason}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant="secondary">{row.original.status}</Badge>
        ),
      },
      {
        id: "total",
        header: "Order total",
        cell: ({ row }) =>
          formatPaise(row.original.order?.grandTotalPaise ?? 0),
      },
      {
        accessorKey: "createdAt",
        header: "Requested",
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const item = row.original
          if (item.status !== "REQUESTED") return null
          return (
            <RowActionsMenu
              label="Return actions"
              items={[
                {
                  label: "Approve (restock)",
                  onClick: () => {
                    setError(null)
                    setApproveId(item.id)
                  },
                },
                {
                  label: "Reject",
                  onClick: () => {
                    setError(null)
                    setRejectReason("")
                    setRejectTarget(item)
                  },
                },
              ]}
            />
          )
        },
      },
    ],
    []
  )

  if (returnsQuery.isLoading) {
    return <DataTableSkeleton columns={6} rows={6} />
  }

  if (returnsQuery.isError) {
    return (
      <div className="flex flex-col gap-4">
        <AdminPageHeader title="Returns" />
        <p className="text-sm text-destructive">
          {returnsQuery.error instanceof Error
            ? returnsQuery.error.message
            : "Failed to load returns."}
        </p>
      </div>
    )
  }

  const rows = returnsQuery.data?.data ?? []
  const pagination = returnsQuery.data?.pagination

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Returns"
        description="Approve restocks for delivered orders."
      />

      <AdminFilterBar
        dirty={statusFilter !== "ALL"}
        onClear={() => {
          setStatusFilter("ALL")
          setPage(1)
        }}
      >
        <AdminFilterSelect
          id="return-status"
          label="Status"
          value={statusFilter}
          onChange={(value) => {
            setPage(1)
            setStatusFilter(value as "ALL" | OrderReturnStatus)
          }}
          options={[
            { value: "ALL", label: "All statuses" },
            { value: "REQUESTED", label: "Requested" },
            { value: "APPROVED", label: "Approved" },
            { value: "REJECTED", label: "Rejected" },
          ]}
        />
      </AdminFilterBar>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <DataTable
        columns={columns}
        data={rows}
        emptyMessage="No return requests."
        paginate={false}
      />

      <ListPagination pagination={pagination} onPageChange={setPage} />

      <ConfirmDialog
        open={Boolean(approveId)}
        onOpenChange={(open) => {
          if (!open) setApproveId(null)
        }}
        title="Approve return?"
        description="Stock will be restored and the order marked as returned (restocked)."
        confirmLabel="Approve & restock"
        pending={approveMutation.isPending}
        onConfirm={() => {
          if (approveId) approveMutation.mutate(approveId)
        }}
      />

      <Dialog
        open={Boolean(rejectTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null)
            setRejectReason("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject return</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="reject-reason">Note (optional)</FieldLabel>
              <Input
                id="reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason for rejection"
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRejectTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={rejectMutation.isPending}
              onClick={() => rejectMutation.mutate()}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
