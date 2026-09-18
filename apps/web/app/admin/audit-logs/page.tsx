"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  AdminFilterBar,
  AdminFilterSearch,
} from "@/components/admin/admin-filter-bar"
import { DataTableSkeleton } from "@/components/admin/data-table-skeleton"
import { AdminPageHeader } from "@/components/admin/page-header"
import {
  PlatformStoreFilter,
  usePlatformStoreFilter,
} from "@/components/admin/platform-store-filter"
import { PermissionGate } from "@/components/admin/permission-gate"
import { DataTable, type AppColumnDef } from "@/components/data-table"
import { ListPagination } from "@/components/list-pagination"
import {
  listPlatformAuditLogs,
  type PlatformAuditLog,
} from "@/lib/api/platform/audit-logs"
import { listPlatformStores } from "@/lib/api/platform/stores"
import { ADMIN_TABLE_PAGE_SIZE } from "@/lib/admin-table"
import { formatDate } from "@/lib/format"

export default function PlatformAuditLogsPage() {
  return (
    <PermissionGate permission="audit_logs.read">
      <AuditLogsPageContent />
    </PermissionGate>
  )
}

function AuditLogsPageContent() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const { storeId, setStoreId } = usePlatformStoreFilter()

  const storesQuery = useQuery({
    queryKey: ["platform", "stores"],
    queryFn: () => listPlatformStores({ pageSize: 100 }),
  })

  const logsQuery = useQuery({
    queryKey: ["platform", "audit-logs", page, storeId],
    queryFn: () =>
      listPlatformAuditLogs({
        page,
        pageSize: ADMIN_TABLE_PAGE_SIZE,
        storeId: storeId || undefined,
      }),
  })

  const filteredLogs = useMemo(() => {
    const items = logsQuery.data?.data ?? []
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((log) => {
      const haystack = [
        log.action,
        log.resourceType,
        log.resourceId,
        log.storeId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [logsQuery.data?.data, search])

  const columns = useMemo<AppColumnDef<PlatformAuditLog>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: "When",
        sortFn: "datetime",
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
      {
        accessorKey: "action",
        header: "Action",
      },
      {
        accessorKey: "resourceType",
        header: "Resource",
        cell: ({ row }) =>
          `${row.original.resourceType}${
            row.original.resourceId ? ` · ${row.original.resourceId}` : ""
          }`,
      },
      {
        accessorKey: "storeId",
        header: "Store",
        cell: ({ row }) =>
          row.original.storeId
            ? storesQuery.data?.data.find((s) => s.id === row.original.storeId)
                ?.name ?? row.original.storeId
            : "—",
      },
    ],
    [storesQuery.data?.data]
  )

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Audit logs"
        description="Platform activity trail"
        breadcrumbs={[{ label: "Audit logs" }]}
      />

      <AdminFilterBar
        dirty={storeId !== "" || search.trim() !== ""}
        onClear={() => {
          setStoreId("")
          setSearch("")
          setPage(1)
        }}
        end={
          <AdminFilterSearch
            value={search}
            onChange={setSearch}
            placeholder="Search action or resource…"
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
      </AdminFilterBar>

      {logsQuery.isError ? (
        <p className="text-sm text-destructive">
          {logsQuery.error instanceof Error
            ? logsQuery.error.message
            : "Failed to load audit logs."}
        </p>
      ) : null}

      {logsQuery.isLoading ? (
        <DataTableSkeleton columns={4} rows={8} />
      ) : (
        <>
          <DataTable
              columns={columns}
              data={filteredLogs}
              paginate={false}
              emptyMessage={
                search.trim() || storeId
                  ? "No audit logs match your filters."
                  : "No audit logs yet."
              }
            />
          <ListPagination
            pagination={logsQuery.data?.pagination}
            onPageChange={setPage}
            disabled={logsQuery.isFetching}
          />
        </>
      )}
    </div>
  )
}
