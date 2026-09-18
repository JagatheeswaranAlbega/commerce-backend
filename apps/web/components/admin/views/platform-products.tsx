"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import type { AppColumnDef } from "@/components/data-table"

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
import { DataTable } from "@/components/data-table"
import { ListPagination } from "@/components/list-pagination"
import { Badge } from "@/components/ui/badge"
import {
  listPlatformProducts,
  type PlatformProduct,
} from "@/lib/api/platform/products"
import { listPlatformStores } from "@/lib/api/platform/stores"
import { ADMIN_TABLE_PAGE_SIZE } from "@/lib/admin-table"
import { formatDate } from "@/lib/format"

export function PlatformProducts() {
  const { storeId, setStoreId } = usePlatformStoreFilter()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [search, setSearch] = useState("")

  const storesQuery = useQuery({
    queryKey: ["platform", "stores"],
    queryFn: () => listPlatformStores({ pageSize: 100 }),
  })

  const productsQuery = useQuery({
    queryKey: ["platform", "products", page, storeId, statusFilter],
    queryFn: () =>
      listPlatformProducts({
        page,
        pageSize: ADMIN_TABLE_PAGE_SIZE,
        storeId: storeId || undefined,
        status: statusFilter === "ALL" ? undefined : statusFilter,
      }),
  })

  const filtered = useMemo(() => {
    const items = productsQuery.data?.data ?? []
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((product) => {
      const haystack = [
        product.title,
        product.name,
        product.handle,
        product.slug,
        product.storeName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [productsQuery.data?.data, search])

  const columns = useMemo<AppColumnDef<PlatformProduct>[]>(
    () => [
      {
        id: "title",
        header: "Title",
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.title ?? row.original.name}
          </span>
        ),
      },
      {
        id: "handle",
        header: "Handle",
        cell: ({ row }) => row.original.handle ?? row.original.slug,
      },
      {
        accessorKey: "storeName",
        header: "Store",
        cell: ({ row }) => (
          <Link
            href={`/admin/stores/${row.original.storeId}`}
            className="underline-offset-4 hover:underline"
          >
            {row.original.storeName ??
              storesQuery.data?.data.find((s) => s.id === row.original.storeId)
                ?.name ??
              row.original.storeId}
          </Link>
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
        cell: ({ row }) => (
          <Link
            href={`/admin/stores/${row.original.storeId}`}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Open store
          </Link>
        ),
      },
    ],
    [storesQuery.data?.data]
  )

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Products"
        description="Read-only catalog visibility across stores"
        breadcrumbs={[{ label: "Products" }]}
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
            placeholder="Search products…"
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
          id="platform-product-status"
          label="Status"
          value={statusFilter}
          onChange={(value) => {
            setStatusFilter(value)
            setPage(1)
          }}
          options={[
            { value: "ALL", label: "All statuses" },
            { value: "ACTIVE", label: "Published" },
            { value: "DRAFT", label: "Draft" },
            { value: "ARCHIVED", label: "Archived" },
          ]}
        />
      </AdminFilterBar>

      {productsQuery.isError ? (
        <p className="text-sm text-destructive">
          {productsQuery.error instanceof Error
            ? productsQuery.error.message
            : "Failed to load products."}
        </p>
      ) : null}

      {productsQuery.isLoading ? (
        <DataTableSkeleton columns={6} rows={8} />
      ) : (
        <>
          <DataTable
              columns={columns}
              data={filtered}
              paginate={false}
              emptyMessage="No products found for this filter."
            />
          <ListPagination
            pagination={productsQuery.data?.pagination}
            onPageChange={setPage}
            disabled={productsQuery.isFetching}
          />
        </>
      )}
    </div>
  )
}
