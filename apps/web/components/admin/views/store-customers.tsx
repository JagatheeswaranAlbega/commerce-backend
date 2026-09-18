"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { DataTableSkeleton } from "@/components/admin/data-table-skeleton"
import {
  AdminFilterBar,
  AdminFilterSearch,
} from "@/components/admin/admin-filter-bar"
import { AdminPageHeader } from "@/components/admin/page-header"
import { DataTable, type AppColumnDef } from "@/components/data-table"
import { ListPagination } from "@/components/list-pagination"
import {
  listAdminCustomers,
  type AdminCustomer,
} from "@/lib/api/admin/customers"
import { ADMIN_TABLE_PAGE_SIZE } from "@/lib/admin-table"
import { formatDate } from "@/lib/format"

export function StoreCustomers() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")

  const customersQuery = useQuery({
    queryKey: ["admin", "customers", page, search],
    queryFn: () =>
      listAdminCustomers({
        page,
        pageSize: ADMIN_TABLE_PAGE_SIZE,
        q: search.trim() || undefined,
      }),
  })

  const filtered = customersQuery.data?.data ?? []

  const columns = useMemo<AppColumnDef<AdminCustomer>[]>(
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
        accessorKey: "phone",
        header: "Phone",
        cell: ({ row }) => row.original.phone ?? "—",
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
    []
  )

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Customers"
        description="Customers associated with this store"
        breadcrumbs={[{ label: "Customers" }]}
      />

      <AdminFilterBar
        dirty={search.trim() !== ""}
        onClear={() => {
          setSearch("")
          setPage(1)
        }}
      >
        <AdminFilterSearch
          value={search}
          onChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          placeholder="Search name, email, phone…"
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
            emptyMessage={
              search.trim()
                ? "No customers match your search."
                : "No customers yet."
            }
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
