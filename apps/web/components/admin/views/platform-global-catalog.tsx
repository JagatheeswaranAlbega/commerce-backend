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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "cn"
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
import {
  globalCategoryById,
  globalCategoryLabel,
  globalCategorySelectOptions,
  sortGlobalCategories,
} from "@/lib/global-category-label"

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
  const [categoryParentId, setCategoryParentId] = useState("")

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
      setCategoryParentId("")
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

  const categories = categoriesQuery.data ?? []
  const categoryById = useMemo(() => globalCategoryById(categories), [categories])
  const categoryOptions = useMemo(
    () => globalCategorySelectOptions(categories),
    [categories]
  )
  const orderedCategories = useMemo(
    () => sortGlobalCategories(categories),
    [categories]
  )

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
        cell: ({ row }) => {
          const category = row.original.categoryId
            ? categoryById.get(row.original.categoryId)
            : undefined
          return category ? globalCategoryLabel(category, categoryById) : "—"
        },
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
            ...categoryOptions,
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
            setCategoryParentId("")
          }
        }}
      >
        <DialogContent className="flex max-h-[min(40rem,calc(100vh-2rem))] w-[calc(100vw-2rem)] max-w-lg flex-col gap-4 overflow-hidden">
          <DialogHeader>
            <DialogTitle>Global categories</DialogTitle>
            <DialogDescription>
              Top-level categories appear in product filters. Child categories stay
              nested under a parent.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border">
            {orderedCategories.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No categories yet.
              </p>
            ) : (
              <ul className="divide-y">
                {orderedCategories.map((category) => (
                  <li
                    key={category.id}
                    className={cn(
                      "flex items-center justify-between gap-3 py-2.5 pr-3",
                      category.parentId ? "bg-muted/30 pl-8" : "pl-3"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {category.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {category.parentId
                          ? `${categoryById.get(category.parentId)?.name ?? "Parent"} · /${category.slug}`
                          : `/${category.slug}`}
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

          <FieldGroup className="shrink-0">
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
                placeholder="e.g. rings"
              />
            </Field>
            <Field>
              <FieldLabel>Parent</FieldLabel>
              <select
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                value={categoryParentId}
                onChange={(e) => setCategoryParentId(e.target.value)}
              >
                <option value="">None — top level</option>
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </FieldGroup>

          <DialogFooter className="shrink-0">
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
                  parentId: categoryParentId || null,
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
