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
import { ProductStatusBadge } from "@/components/admin/products/product-status-badge"
import { ProductTableThumbnail } from "@/components/admin/products/product-table-thumbnail"
import { DataTable, type AppColumnDef } from "@/components/data-table"
import { ListPagination } from "@/components/list-pagination"
import { RowActionsMenu } from "@/components/row-actions-menu"
import { Button } from "@/components/ui/button"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import {
  deleteAdminProduct,
  listAdminProducts,
  type AdminProduct,
  type ProductStatus,
} from "@/lib/api/admin/products"
import { ADMIN_TABLE_PAGE_SIZE } from "@/lib/admin-table"
import { formatDate } from "@/lib/format"

export function StoreProducts() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<ProductStatus | "ALL">("ALL")
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search.trim(), 300)
  const [pendingDelete, setPendingDelete] = useState<AdminProduct | null>(null)

  const productsQuery = useQuery({
    queryKey: ["admin", "products", page, statusFilter, debouncedSearch],
    queryFn: () =>
      listAdminProducts({
        page,
        pageSize: ADMIN_TABLE_PAGE_SIZE,
        status: statusFilter === "ALL" ? undefined : statusFilter,
        q: debouncedSearch || undefined,
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteAdminProduct,
    onSuccess: async () => {
      setPendingDelete(null)
      await queryClient.invalidateQueries({ queryKey: ["admin", "products"] })
    },
  })

  const columns = useMemo<AppColumnDef<AdminProduct>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Product",
        cell: ({ row }) => (
          <Link
            href={`/admin/products/${row.original.id}`}
            className="flex min-w-0 items-center gap-3 font-medium hover:underline"
          >
            <ProductTableThumbnail
              mediaId={row.original.thumbnail?.id}
              title={row.original.title}
            />
            <span className="truncate">{row.original.title}</span>
          </Link>
        ),
      },
      {
        accessorKey: "handle",
        header: "Handle",
        cell: ({ row }) => (
          <span className="text-muted-foreground">/{row.original.handle}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <ProductStatusBadge status={row.original.status} />
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
          <RowActionsMenu
            label="Product actions"
            items={[
              {
                label: "Edit",
                onClick: () =>
                  router.push(`/admin/products/${row.original.id}`),
              },
              {
                label: "Delete",
                variant: "destructive",
                disabled: deleteMutation.isPending,
                onClick: () => setPendingDelete(row.original),
              },
            ]}
          />
        ),
      },
    ],
    [deleteMutation.isPending, router]
  )

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Products"
        description="Create and manage products for this store"
        breadcrumbs={[{ label: "Products" }]}
        actions={
          <Button
            nativeButton={false}
            render={<Link href="/admin/products/create" />}
          >
            Create product
          </Button>
        }
      />

      <AdminFilterBar
        dirty={statusFilter !== "ALL" || search.trim() !== ""}
        onClear={() => {
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
        <AdminFilterSelect
          id="status-filter"
          label="Status"
          value={statusFilter}
          onChange={(value) => {
            setPage(1)
            setStatusFilter(value as ProductStatus | "ALL")
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
              data={productsQuery.data?.data ?? []}
              paginate={false}
              emptyMessage={
                debouncedSearch
                  ? "No products match your search."
                  : "No products yet."
              }
            />
          <ListPagination
            pagination={productsQuery.data?.pagination}
            onPageChange={setPage}
            disabled={productsQuery.isFetching}
          />
        </>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title="Delete product?"
        description={
          pendingDelete
            ? `Delete “${pendingDelete.title}”? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        pending={deleteMutation.isPending}
        onConfirm={() => {
          if (pendingDelete) deleteMutation.mutate(pendingDelete.id)
        }}
      />
    </div>
  )
}
