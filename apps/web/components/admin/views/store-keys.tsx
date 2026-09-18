"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { DataTableSkeleton } from "@/components/admin/data-table-skeleton"
import {
  AdminFilterBar,
  AdminFilterSelect,
} from "@/components/admin/admin-filter-bar"
import { AdminPageHeader } from "@/components/admin/page-header"
import { CopyButton } from "@/components/copy-button"
import { DataTable, type AppColumnDef } from "@/components/data-table"
import { RowActionsMenu } from "@/components/row-actions-menu"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  createAdminKey,
  listAdminKeys,
  revokeAdminKey,
  type AdminApiKey,
  type CreateAdminApiKeyResult,
} from "@/lib/api/admin/keys"
import { formatDate } from "@/lib/format"

type TypeFilter = "ALL" | AdminApiKey["type"]
type StatusFilter = "ALL" | AdminApiKey["status"]

export function StoreKeys() {
  const queryClient = useQueryClient()
  const [createdKey, setCreatedKey] = useState<CreateAdminApiKeyResult | null>(null)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")

  const keysQuery = useQuery({
    queryKey: ["admin", "keys"],
    queryFn: listAdminKeys,
  })

  const createMutation = useMutation({
    mutationFn: createAdminKey,
    onSuccess: async (key) => {
      setCreatedKey(key)
      await queryClient.invalidateQueries({ queryKey: ["admin", "keys"] })
    },
  })

  const revokeMutation = useMutation({
    mutationFn: revokeAdminKey,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "keys"] })
    },
  })

  const filteredKeys = useMemo(() => {
    const keys = keysQuery.data ?? []
    return keys.filter((key) => {
      if (typeFilter !== "ALL" && key.type !== typeFilter) return false
      if (statusFilter !== "ALL" && key.status !== statusFilter) return false
      return true
    })
  }, [keysQuery.data, statusFilter, typeFilter])

  const columns = useMemo<AppColumnDef<AdminApiKey>[]>(
    () => [
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => (
          <Badge variant="secondary">{row.original.type}</Badge>
        ),
      },
      {
        accessorKey: "keyPrefix",
        header: "Prefix",
        cell: ({ row }) => {
          const prefix = row.original.keyPrefix
          return (
            <div className="flex items-center gap-2">
              <code className="text-xs">{prefix}…</code>
              <CopyButton
                value={prefix}
                label="Copy key prefix"
                size="icon-xs"
              />
            </div>
          )
        },
      },
      {
        accessorKey: "status",
        header: "Status",
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        sortFn: "datetime",
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <RowActionsMenu
            label="API key actions"
            items={
              row.original.status === "ACTIVE"
                ? [
                    {
                      label: "Delete",
                      variant: "destructive",
                      disabled: revokeMutation.isPending,
                      onClick: () => revokeMutation.mutate(row.original.id),
                    },
                  ]
                : []
            }
          />
        ),
      },
    ],
    [revokeMutation]
  )

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="API keys"
        description="Publishable and secret keys for this store"
        breadcrumbs={[{ label: "API keys" }]}
        actions={
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate("PUBLISHABLE")}
            >
              New publishable
            </Button>
            <Button
              type="button"
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate("SECRET")}
            >
              New secret
            </Button>
          </div>
        }
      />

      <AdminFilterBar
        dirty={typeFilter !== "ALL" || statusFilter !== "ALL"}
        onClear={() => {
          setTypeFilter("ALL")
          setStatusFilter("ALL")
        }}
      >
        <AdminFilterSelect
          id="type-filter"
          label="Type"
          value={typeFilter}
          onChange={(value) => setTypeFilter(value as TypeFilter)}
          options={[
            { value: "ALL", label: "All types" },
            { value: "PUBLISHABLE", label: "Publishable" },
            { value: "SECRET", label: "Secret" },
          ]}
        />
        <AdminFilterSelect
          id="status-filter"
          label="Status"
          value={statusFilter}
          onChange={(value) => setStatusFilter(value as StatusFilter)}
          options={[
            { value: "ALL", label: "All statuses" },
            { value: "ACTIVE", label: "Active" },
            { value: "REVOKED", label: "Revoked" },
          ]}
        />
      </AdminFilterBar>

      {createdKey ? (
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <p className="font-medium">
            {createdKey.type === "PUBLISHABLE" ? "Publishable key" : "Secret key"}{" "}
            — copy now, it will not be shown again
          </p>
          <div className="mt-2 flex items-start gap-2">
            <code className="min-w-0 flex-1 break-all text-xs">
              {createdKey.rawKey}
            </code>
            <CopyButton
              value={createdKey.rawKey}
              label={
                createdKey.type === "PUBLISHABLE"
                  ? "Copy publishable key"
                  : "Copy secret key"
              }
            />
          </div>
        </div>
      ) : null}

      {keysQuery.isLoading ? (
        <DataTableSkeleton columns={4} rows={6} />
      ) : (
        <DataTable
            columns={columns}
            data={filteredKeys}
            emptyMessage="No API keys yet."
          />
      )}
    </div>
  )
}
