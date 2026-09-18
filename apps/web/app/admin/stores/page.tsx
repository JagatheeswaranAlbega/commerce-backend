"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { DataTable, type AppColumnDef } from "@/components/data-table"
import {
  AdminFilterBar,
  AdminFilterSearch,
  AdminFilterSelect,
} from "@/components/admin/admin-filter-bar"
import { DataTableSkeleton } from "@/components/admin/data-table-skeleton"
import { AdminPageHeader } from "@/components/admin/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PermissionGate } from "@/components/admin/permission-gate"
import {
  listPlatformStores,
  type PlatformStore,
} from "@/lib/api/platform/stores"
import { formatDate } from "@/lib/format"

export default function PlatformStoresPage() {
  return (
    <PermissionGate permission="stores.read">
      <StoresPageContent />
    </PermissionGate>
  )
}

function StoresPageContent() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")

  const storesQuery = useQuery({
    queryKey: ["platform", "stores"],
    queryFn: () => listPlatformStores({ pageSize: 100 }),
  })

  const filteredStores = useMemo(() => {
    const items = storesQuery.data?.data ?? []
    const q = search.trim().toLowerCase()
    return items.filter((store) => {
      if (statusFilter !== "ALL" && store.status !== statusFilter) return false
      if (!q) return true
      const haystack = [store.name, store.slug, store.domain]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [search, statusFilter, storesQuery.data?.data])

  const columns = useMemo<AppColumnDef<PlatformStore>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <Link
            href={`/admin/stores/${row.original.id}`}
            className="font-medium underline-offset-4 hover:underline"
          >
            {row.original.name}
          </Link>
        ),
      },
      { accessorKey: "slug", header: "Slug" },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge
            variant={
              row.original.status === "ACTIVE" ? "secondary" : "outline"
            }
          >
            {row.original.status}
          </Badge>
        ),
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
        cell: ({ row }) => formatDate(row.original.updatedAt),
      },
    ],
    []
  )

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Stores"
        description="All merchant stores on the platform"
        breadcrumbs={[{ label: "Stores" }]}
        actions={
          <Button nativeButton={false} render={<Link href="/admin/stores/new" />}>
            Create store
          </Button>
        }
      />

      <AdminFilterBar
        dirty={statusFilter !== "ALL" || search.trim() !== ""}
        onClear={() => {
          setStatusFilter("ALL")
          setSearch("")
        }}
        end={
          <AdminFilterSearch
            value={search}
            onChange={setSearch}
            placeholder="Search name, slug, domain…"
          />
        }
      >
        <AdminFilterSelect
          id="store-status-filter"
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "ALL", label: "All statuses" },
            { value: "ACTIVE", label: "Active" },
            { value: "INACTIVE", label: "Inactive" },
          ]}
        />
      </AdminFilterBar>

      {storesQuery.isError ? (
        <p className="text-sm text-destructive">
          {storesQuery.error instanceof Error
            ? storesQuery.error.message
            : "Failed to load stores."}
        </p>
      ) : null}

      {storesQuery.isLoading ? (
        <DataTableSkeleton columns={5} rows={6} />
      ) : (
        <DataTable
            columns={columns}
            data={filteredStores}
            emptyMessage={
              search.trim() || statusFilter !== "ALL"
                ? "No stores match your filters."
                : "No stores yet."
            }
          />
      )}
    </div>
  )
}
