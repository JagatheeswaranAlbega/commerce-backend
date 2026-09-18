"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { DataTableSkeleton } from "@/components/admin/data-table-skeleton"
import {
  AdminFilterBar,
  AdminFilterSelect,
} from "@/components/admin/admin-filter-bar"
import { AdminPageHeader } from "@/components/admin/page-header"
import {
  PlatformStoreFilter,
  usePlatformStoreFilter,
} from "@/components/admin/platform-store-filter"
import { CopyButton } from "@/components/copy-button"
import { DataTable, type AppColumnDef } from "@/components/data-table"
import { RowActionsMenu } from "@/components/row-actions-menu"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  createStoreKey,
  deleteStoreKey,
  listStoreKeys,
  type ApiKeyType,
  type CreateApiKeyResult,
  type PlatformApiKey,
} from "@/lib/api/platform/keys"
import { listPlatformStores } from "@/lib/api/platform/stores"
import { formatDate } from "@/lib/format"

type TypeFilter = "ALL" | ApiKeyType
type StatusFilter = "ALL" | PlatformApiKey["status"]

export function PlatformKeys() {
  const queryClient = useQueryClient()
  const { storeId, setStoreId } = usePlatformStoreFilter()
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")
  const [createdKey, setCreatedKey] = useState<CreateApiKeyResult | null>(null)

  const storesQuery = useQuery({
    queryKey: ["platform", "stores"],
    queryFn: () => listPlatformStores({ pageSize: 100 }),
  })

  const selectedStoreId = storeId || storesQuery.data?.data[0]?.id || ""

  const keysQuery = useQuery({
    queryKey: ["platform", "stores", selectedStoreId, "keys"],
    queryFn: () => listStoreKeys(selectedStoreId, { pageSize: 100 }),
    enabled: Boolean(selectedStoreId),
  })

  const createMutation = useMutation({
    mutationFn: (type: "PUBLISHABLE" | "SECRET") =>
      createStoreKey(selectedStoreId, { type }),
    onSuccess: async (key) => {
      setCreatedKey(key)
      await queryClient.invalidateQueries({
        queryKey: ["platform", "stores", selectedStoreId, "keys"],
      })
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (keyId: string) => deleteStoreKey(selectedStoreId, keyId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["platform", "stores", selectedStoreId, "keys"],
      })
    },
  })

  const filteredKeys = useMemo(() => {
    const keys = keysQuery.data?.data ?? []
    return keys.filter((key) => {
      if (typeFilter !== "ALL" && key.type !== typeFilter) return false
      if (statusFilter !== "ALL" && key.status !== statusFilter) return false
      return true
    })
  }, [keysQuery.data?.data, statusFilter, typeFilter])

  const columns = useMemo<AppColumnDef<PlatformApiKey>[]>(
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
          const prefix = row.original.keyPrefix ?? row.original.prefix ?? ""
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
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => row.original.status,
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
        description="Publishable and secret keys per store"
        breadcrumbs={[{ label: "API keys" }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!selectedStoreId || createMutation.isPending}
              onClick={() => createMutation.mutate("PUBLISHABLE")}
            >
              New publishable
            </Button>
            <Button
              type="button"
              disabled={!selectedStoreId || createMutation.isPending}
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
        <PlatformStoreFilter
          value={selectedStoreId}
          onChange={(next) => {
            setStoreId(next)
            setCreatedKey(null)
          }}
          allowAll={false}
        />
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

      {keysQuery.isError ? (
        <p className="text-sm text-destructive">
          {keysQuery.error instanceof Error
            ? keysQuery.error.message
            : "Failed to load keys."}
        </p>
      ) : null}

      {keysQuery.isLoading || storesQuery.isLoading ? (
        <DataTableSkeleton columns={4} rows={6} />
      ) : (
        <DataTable
            columns={columns}
            data={filteredKeys}
            emptyMessage="No API keys for this store."
          />
      )}
    </div>
  )
}
