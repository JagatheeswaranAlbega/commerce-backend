"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { DataTable, type AppColumnDef } from "@/components/data-table"
import { DataTableSkeleton } from "@/components/admin/data-table-skeleton"
import {
  AdminFilterBar,
  AdminFilterSearch,
} from "@/components/admin/admin-filter-bar"
import { AdminPageHeader } from "@/components/admin/page-header"
import {
  PlatformStoreFilter,
  usePlatformStoreFilter,
} from "@/components/admin/platform-store-filter"
import { ListPagination } from "@/components/list-pagination"
import {
  listPlatformCustomers,
  type PlatformCustomer,
} from "@/lib/api/platform/customers"
import { listPlatformStores } from "@/lib/api/platform/stores"
import { ADMIN_TABLE_PAGE_SIZE } from "@/lib/admin-table"
import { formatDate } from "@/lib/format"

export function PlatformCustomers() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const { storeId, setStoreId } = usePlatformStoreFilter()

  const storesQuery = useQuery({
    queryKey: ["platform", "stores"],
    queryFn: () => listPlatformStores({ pageSize: 100 }),
  })

  const customersQuery = useQuery({
    queryKey: ["platform", "customers", page, storeId],
    queryFn: () =>
      listPlatformCustomers({
        page,
        pageSize: ADMIN_TABLE_PAGE_SIZE,
        storeId: storeId || undefined,
      }),
  })

  const filtered = useMemo(() => {
    const items = customersQuery.data?.data ?? []
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((customer) => {
      const haystack = [customer.name, customer.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [customersQuery.data?.data, search])

  const columns = useMemo<AppColumnDef<PlatformCustomer>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <Link
            href={`/admin/customers/${row.original.id}`}
            className="font-medium hover:underline"
          >
            {row.original.name ?? "—"}
          </Link>
        ),
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => row.original.email ?? "—",
      },
      {
        accessorKey: "storeId",
        header: "Store",
        cell: ({ row }) =>
          storesQuery.data?.data.find((s) => s.id === row.original.storeId)
            ?.name ?? row.original.storeId,
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

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Customers"
        description="Customers across all stores"
        breadcrumbs={[{ label: "Customers" }]}
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
            placeholder="Search name or email…"
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

      {customersQuery.isError ? (
        <p className="text-sm text-destructive">
          {customersQuery.error instanceof Error
            ? customersQuery.error.message
            : "Failed to load customers."}
        </p>
      ) : null}

      {customersQuery.isLoading ? (
        <DataTableSkeleton columns={5} rows={8} />
      ) : (
        <>
          <DataTable
              columns={columns}
              data={filtered}
              paginate={false}
              emptyMessage="No customers yet."
            />
          <ListPagination
            pagination={customersQuery.data?.pagination}
            onPageChange={setPage}
            disabled={customersQuery.isFetching}
          />
        </>
      )}
    </div>
  )
}
