"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  AdminFilterBar,
  AdminFilterSearch,
  AdminFilterSelect,
} from "@/components/admin/admin-filter-bar"
import { DataTableSkeleton } from "@/components/admin/data-table-skeleton"
import { AdminPageHeader } from "@/components/admin/page-header"
import { useAdminPermissions } from "@/components/admin/permission-gate"
import { ProductStatusBadge } from "@/components/admin/products/product-status-badge"
import { ProductTableThumbnail } from "@/components/admin/products/product-table-thumbnail"
import { DataTable, type AppColumnDef } from "@/components/data-table"
import { ListPagination } from "@/components/list-pagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { ImportCategoryDialog } from "@/components/admin/global-catalog/import-category-dialog"
import {
  importAdminGlobalProducts,
  listAdminGlobalCategories,
  listAdminGlobalProducts,
  type ImportStoreCategoryAssignment,
} from "@/lib/api/admin/global-catalog"
import type { GlobalProduct, GlobalProductStatus } from "@/lib/api/platform/global-catalog"
import { ADMIN_TABLE_PAGE_SIZE } from "@/lib/admin-table"
import { formatDate } from "@/lib/format"
import {
  globalCategoryById,
  globalCategoryLabel,
  globalCategorySelectOptions,
} from "@/lib/global-category-label"
import { appToast } from "@/lib/toast"
import { cn } from "cn"

function isImportable(product: GlobalProduct) {
  return product.status === "ACTIVE" && !product.imported
}

function SelectionCheckbox({
  checked,
  indeterminate = false,
  disabled = false,
  onChange,
  "aria-label": ariaLabel,
}: {
  checked: boolean
  indeterminate?: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
  "aria-label": string
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      aria-label={ariaLabel}
      ref={(el) => {
        if (el) el.indeterminate = indeterminate && !checked
      }}
      onChange={(e) => onChange(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "size-4 shrink-0 rounded border border-input accent-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
        "disabled:cursor-not-allowed disabled:opacity-50"
      )}
    />
  )
}

export function StoreGlobalCatalog() {
  const queryClient = useQueryClient()
  const { can } = useAdminPermissions()
  const canImport = can("global_catalog.import")

  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<GlobalProductStatus | "ALL">("ACTIVE")
  const [importedFilter, setImportedFilter] = useState<"ALL" | "YES" | "NO">("ALL")
  const [categoryFilter, setCategoryFilter] = useState("ALL")
  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [importOpen, setImportOpen] = useState(false)
  const debouncedSearch = useDebouncedValue(search.trim(), 300)

  const categoriesQuery = useQuery({
    queryKey: ["admin", "global-categories"],
    queryFn: () => listAdminGlobalCategories({ status: "ACTIVE" }),
  })

  const productsQuery = useQuery({
    queryKey: [
      "admin",
      "global-products",
      page,
      statusFilter,
      importedFilter,
      categoryFilter,
      debouncedSearch,
    ],
    queryFn: () =>
      listAdminGlobalProducts({
        page,
        pageSize: ADMIN_TABLE_PAGE_SIZE,
        status: statusFilter === "ALL" ? undefined : statusFilter,
        categoryId: categoryFilter === "ALL" ? undefined : categoryFilter,
        q: debouncedSearch || undefined,
        imported: importedFilter === "ALL" ? undefined : importedFilter === "YES",
      }),
  })

  const products = productsQuery.data?.data ?? []
  const importableOnPage = useMemo(
    () => products.filter(isImportable),
    [products]
  )

  useEffect(() => {
    setSelectedIds(new Set())
  }, [page, statusFilter, importedFilter, categoryFilter, debouncedSearch])

  const selectedCount = selectedIds.size
  const selectedOnPageCount = importableOnPage.filter((p) =>
    selectedIds.has(p.id)
  ).length
  const allImportableSelected =
    importableOnPage.length > 0 && selectedOnPageCount === importableOnPage.length
  const someImportableSelected =
    selectedOnPageCount > 0 && selectedOnPageCount < importableOnPage.length

  const importMutation = useMutation({
    mutationFn: ({
      productIds,
      assignment,
    }: {
      productIds: string[]
      assignment: ImportStoreCategoryAssignment
    }) => importAdminGlobalProducts(productIds, assignment),
    onSuccess: async (result) => {
      setSelectedIds(new Set())
      setImportOpen(false)
      await queryClient.invalidateQueries({ queryKey: ["admin", "global-products"] })
      await queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] })
      await queryClient.invalidateQueries({ queryKey: ["admin", "products"] })
      await queryClient.invalidateQueries({ queryKey: ["admin", "categories"] })

      if (result.failedCount === 0) {
        appToast.success(
          result.importedCount === 1
            ? "1 product imported into your store"
            : `${result.importedCount} products imported into your store`
        )
      } else if (result.importedCount > 0) {
        appToast.warning(
          `Imported ${result.importedCount}; ${result.failedCount} failed.`
        )
      } else {
        appToast.error(result.failed[0]?.message ?? "No products were imported.")
      }
    },
    onError: (error) => {
      appToast.error(
        error instanceof Error ? error.message : "Import failed."
      )
    },
  })

  function toggleProduct(productId: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(productId)
      else next.delete(productId)
      return next
    })
  }

  function toggleSelectAllOnPage(checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const product of importableOnPage) {
        if (checked) next.add(product.id)
        else next.delete(product.id)
      }
      return next
    })
  }

  const categories = categoriesQuery.data ?? []
  const categoryById = useMemo(() => globalCategoryById(categories), [categories])
  const categoryOptions = useMemo(
    () => globalCategorySelectOptions(categories),
    [categories]
  )

  const suggestedCategory = useMemo(() => {
    const selected = products.filter((product) => selectedIds.has(product.id))
    const firstId = selected[0]?.categoryId
    if (!firstId) return { name: "", slug: "" }
    const same = selected.every((product) => product.categoryId === firstId)
    if (!same) return { name: "", slug: "" }
    const category = categoryById.get(firstId)
    return { name: category?.name ?? "", slug: category?.slug ?? "" }
  }, [categoryById, products, selectedIds])

  const columns = useMemo<AppColumnDef<GlobalProduct>[]>(
    () => [
      ...(canImport
        ? [
            {
              id: "select",
              header: () => (
                <SelectionCheckbox
                  checked={allImportableSelected}
                  indeterminate={someImportableSelected}
                  disabled={importableOnPage.length === 0 || importMutation.isPending}
                  onChange={toggleSelectAllOnPage}
                  aria-label="Select all importable products on this page"
                />
              ),
              cell: ({ row }) => {
                const product = row.original
                const importable = isImportable(product)
                return (
                  <SelectionCheckbox
                    checked={selectedIds.has(product.id)}
                    disabled={!importable || importMutation.isPending}
                    onChange={(checked) => toggleProduct(product.id, checked)}
                    aria-label={`Select ${product.title}`}
                  />
                )
              },
              enableSorting: false,
            } satisfies AppColumnDef<GlobalProduct>,
          ]
        : []),
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
              mediaPathPrefix="/api/v1/admin/global-media"
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
            ? (() => {
                const category = categoryById.get(row.original.categoryId)
                return category ? globalCategoryLabel(category, categoryById) : "—"
              })()
            : "—",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <ProductStatusBadge status={row.original.status} />,
      },
      {
        id: "imported",
        header: "In my store",
        cell: ({ row }) =>
          row.original.imported ? (
            <Badge>Imported</Badge>
          ) : (
            <Badge variant="secondary">Not imported</Badge>
          ),
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
    ],
    [
      allImportableSelected,
      canImport,
      categoryById,
      importMutation.isPending,
      importableOnPage.length,
      selectedIds,
      someImportableSelected,
    ]
  )

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Global Catalog"
        description="Browse platform products and import them into your store catalog."
        breadcrumbs={[{ label: "Global Catalog" }]}
        actions={
          canImport && selectedCount > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedCount} selected
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={importMutation.isPending}
                onClick={() => setSelectedIds(new Set())}
              >
                Clear
              </Button>
              <Button
                size="sm"
                disabled={importMutation.isPending}
                onClick={() => setImportOpen(true)}
              >
                {importMutation.isPending
                  ? "Importing…"
                  : `Import selected (${selectedCount})`}
              </Button>
            </div>
          ) : null
        }
      />

      <AdminFilterBar
        dirty={
          statusFilter !== "ACTIVE" ||
          importedFilter !== "ALL" ||
          categoryFilter !== "ALL" ||
          search.trim() !== ""
        }
        onClear={() => {
          setStatusFilter("ACTIVE")
          setImportedFilter("ALL")
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
          id="store-global-status"
          label="Status"
          value={statusFilter}
          onChange={(value) => {
            setStatusFilter(value as GlobalProductStatus | "ALL")
            setPage(1)
          }}
          options={[
            { value: "ALL", label: "All statuses" },
            { value: "ACTIVE", label: "Active" },
            { value: "DRAFT", label: "Draft" },
            { value: "ARCHIVED", label: "Archived" },
          ]}
        />
        <AdminFilterSelect
          id="store-global-imported"
          label="Import"
          value={importedFilter}
          onChange={(value) => {
            setImportedFilter(value as "ALL" | "YES" | "NO")
            setPage(1)
          }}
          options={[
            { value: "ALL", label: "All imports" },
            { value: "YES", label: "Imported" },
            { value: "NO", label: "Not imported" },
          ]}
        />
        <AdminFilterSelect
          id="store-global-category"
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
            data={products}
            paginate={false}
            emptyMessage="No global products found."
          />
          <ListPagination
            pagination={productsQuery.data?.pagination}
            onPageChange={setPage}
            disabled={productsQuery.isFetching}
          />
        </>
      )}

      <ImportCategoryDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title={
          selectedCount === 1
            ? "Import product"
            : `Import ${selectedCount} products`
        }
        description="Assign these products to an existing store category or create a new one so they appear in your shop."
        confirmLabel={
          selectedCount === 1 ? "Import product" : `Import ${selectedCount} products`
        }
        pending={importMutation.isPending}
        defaultCategoryName={suggestedCategory.name}
        defaultCategorySlug={suggestedCategory.slug}
        onConfirm={(assignment) =>
          importMutation.mutate({ productIds: [...selectedIds], assignment })
        }
      />
    </div>
  )
}
