"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Trash2 } from "lucide-react"

import {
  AdminFilterBar,
  AdminFilterSearch,
  AdminFilterSelect,
} from "@/components/admin/admin-filter-bar"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { DataTableSkeleton } from "@/components/admin/data-table-skeleton"
import { AdminPageHeader } from "@/components/admin/page-header"
import { ProductStatusBadge } from "@/components/admin/products/product-status-badge"
import { ProductTableThumbnail } from "@/components/admin/products/product-table-thumbnail"
import { DataTable, type AppColumnDef } from "@/components/data-table"
import { ListPagination } from "@/components/list-pagination"
import { RowActionsMenu } from "@/components/row-actions-menu"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import {
  createPlatformGlobalCategory,
  deletePlatformGlobalCategory,
  deletePlatformGlobalProduct,
  listPlatformGlobalCategories,
  listPlatformGlobalProducts,
  type GlobalCategory,
  type GlobalProduct,
  type GlobalProductStatus,
} from "@/lib/api/platform/global-catalog"
import { ADMIN_TABLE_PAGE_SIZE } from "@/lib/admin-table"
import { formatDate, slugify } from "@/lib/format"

export function PlatformGlobalCatalog() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<GlobalProductStatus | "ALL">("ALL")
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL")
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search.trim(), 300)
  const [pendingDelete, setPendingDelete] = useState<GlobalProduct | null>(null)
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false)
  const [pendingCategoryDelete, setPendingCategoryDelete] =
    useState<GlobalCategory | null>(null)
  const [categoryName, setCategoryName] = useState("")
  const [categorySlug, setCategorySlug] = useState("")

  const categoriesQuery = useQuery({
    queryKey: ["platform", "global-categories"],
    queryFn: () => listPlatformGlobalCategories(),
  })

  const productsQuery = useQuery({
    queryKey: [
      "platform",
      "global-products",
      page,
      statusFilter,
      categoryFilter,
      debouncedSearch,
    ],
    queryFn: () =>
      listPlatformGlobalProducts({
        page,
        pageSize: ADMIN_TABLE_PAGE_SIZE,
        status: statusFilter === "ALL" ? undefined : statusFilter,
        categoryId: categoryFilter === "ALL" ? undefined : categoryFilter,
        q: debouncedSearch || undefined,
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: deletePlatformGlobalProduct,
    onSuccess: async () => {
      setPendingDelete(null)
      await queryClient.invalidateQueries({ queryKey: ["platform", "global-products"] })
    },
  })

  const createCategoryMutation = useMutation({
    mutationFn: createPlatformGlobalCategory,
    onSuccess: async () => {
      setCategoryName("")
      setCategorySlug("")
      await queryClient.invalidateQueries({ queryKey: ["platform", "global-categories"] })
    },
  })

  const deleteCategoryMutation = useMutation({
    mutationFn: deletePlatformGlobalCategory,
    onSuccess: async (_data, categoryId) => {
      setPendingCategoryDelete(null)
      if (categoryFilter === categoryId) {
        setCategoryFilter("ALL")
        setPage(1)
      }
      await queryClient.invalidateQueries({ queryKey: ["platform", "global-categories"] })
      await queryClient.invalidateQueries({ queryKey: ["platform", "global-products"] })
    },
  })

  const categoryById = useMemo(() => {
    const map = new Map<string, GlobalCategory>()
    for (const category of categoriesQuery.data ?? []) {
      map.set(category.id, category)
    }
    return map
  }, [categoriesQuery.data])

  const columns = useMemo<AppColumnDef<GlobalProduct>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Product",
        cell: ({ row }) => (
          <Link
            href={`/admin/global-catalog/products/${row.original.id}`}
            className="flex min-w-0 items-center gap-3 font-medium hover:underline"
          >
            <ProductTableThumbnail
              mediaId={row.original.thumbnail?.id}
              title={row.original.title}
              mediaPathPrefix="/api/v1/platform/global-media"
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
        id: "category",
        header: "Category",
        cell: ({ row }) =>
          row.original.categoryId
            ? (categoryById.get(row.original.categoryId)?.name ?? "—")
            : "—",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <ProductStatusBadge status={row.original.status} />,
      },
      {
        id: "imports",
        header: "Imports",
        cell: ({ row }) => (
          <Badge variant="secondary">{row.original.importCount ?? 0}</Badge>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => formatDate(row.original.createdAt),
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
                  router.push(`/admin/global-catalog/products/${row.original.id}`),
              },
              {
                label: "Delete",
                variant: "destructive",
                onClick: () => setPendingDelete(row.original),
              },
            ]}
          />
        ),
      },
    ],
    [categoryById, router]
  )

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Global Catalog"
        description="Manage platform-wide categories and master products shared across stores."
        breadcrumbs={[{ label: "Global Catalog" }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setManageCategoriesOpen(true)}>
              Categories
            </Button>
            <Button
              nativeButton={false}
              render={<Link href="/admin/global-catalog/products/create" />}
            >
              Create product
            </Button>
          </div>
        }
      />

      <AdminFilterBar
        dirty={
          statusFilter !== "ALL" ||
          categoryFilter !== "ALL" ||
          search.trim() !== ""
        }
        onClear={() => {
          setStatusFilter("ALL")
          setCategoryFilter("ALL")
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
          id="global-status-filter"
          label="Status"
          value={statusFilter}
          onChange={(value) => {
            setStatusFilter(value as GlobalProductStatus | "ALL")
            setPage(1)
          }}
          options={[
            { value: "ALL", label: "All statuses" },
            { value: "DRAFT", label: "Draft" },
            { value: "ACTIVE", label: "Active" },
            { value: "ARCHIVED", label: "Archived" },
          ]}
        />
        <AdminFilterSelect
          id="global-category-filter"
          label="Category"
          value={categoryFilter}
          onChange={(value) => {
            setCategoryFilter(value)
            setPage(1)
          }}
          options={[
            { value: "ALL", label: "All categories" },
            ...(categoriesQuery.data ?? []).map((category) => ({
              value: category.id,
              label: category.name,
            })),
          ]}
        />
      </AdminFilterBar>

      {productsQuery.isLoading ? (
        <DataTableSkeleton columns={6} rows={6} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={productsQuery.data?.data ?? []}
            paginate={false}
            emptyMessage="No global products yet."
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
        title="Delete global product?"
        description={
          pendingDelete
            ? `“${pendingDelete.title}” will be removed from the global catalog.`
            : ""
        }
        confirmLabel="Delete"
        pending={deleteMutation.isPending}
        onConfirm={() => {
          if (pendingDelete) deleteMutation.mutate(pendingDelete.id)
        }}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
      />

      <Dialog
        open={manageCategoriesOpen}
        onOpenChange={(open) => {
          setManageCategoriesOpen(open)
          if (!open) {
            setCategoryName("")
            setCategorySlug("")
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Global categories</DialogTitle>
          </DialogHeader>

          <div className="overflow-hidden rounded-lg border">
            {(categoriesQuery.data?.length ?? 0) === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No categories yet.
              </p>
            ) : (
              <ul className="divide-y">
                {(categoriesQuery.data ?? []).map((category) => (
                  <li
                    key={category.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{category.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        /{category.slug}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Delete ${category.name}`}
                      disabled={deleteCategoryMutation.isPending}
                      onClick={() => setPendingCategoryDelete(category)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <FieldGroup>
            <Field>
              <FieldLabel>Name</FieldLabel>
              <Input
                value={categoryName}
                onChange={(e) => {
                  setCategoryName(e.target.value)
                  setCategorySlug(slugify(e.target.value))
                }}
                placeholder="e.g. Perfumes"
              />
            </Field>
            <Field>
              <FieldLabel>Slug</FieldLabel>
              <Input
                value={categorySlug}
                onChange={(e) => setCategorySlug(e.target.value)}
                placeholder="e.g. perfumes"
              />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button variant="outline" onClick={() => setManageCategoriesOpen(false)}>
              Done
            </Button>
            <Button
              disabled={
                !categoryName.trim() ||
                !categorySlug.trim() ||
                createCategoryMutation.isPending
              }
              onClick={() =>
                createCategoryMutation.mutate({
                  name: categoryName.trim(),
                  slug: categorySlug.trim(),
                })
              }
            >
              {createCategoryMutation.isPending ? "Adding…" : "Add category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingCategoryDelete)}
        title="Delete category?"
        description={
          pendingCategoryDelete
            ? `“${pendingCategoryDelete.name}” will be removed from the global catalog.`
            : ""
        }
        confirmLabel="Delete"
        pending={deleteCategoryMutation.isPending}
        onConfirm={() => {
          if (pendingCategoryDelete) {
            deleteCategoryMutation.mutate(pendingCategoryDelete.id)
          }
        }}
        onOpenChange={(open) => {
          if (!open) setPendingCategoryDelete(null)
        }}
      />
    </div>
  )
}
