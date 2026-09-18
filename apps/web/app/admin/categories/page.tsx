"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { cn } from "cn"

import {
  AdminFilterBar,
  AdminFilterSearch,
  AdminFilterSelect,
} from "@/components/admin/admin-filter-bar"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { DataTableSkeleton } from "@/components/admin/data-table-skeleton"
import { AdminPageHeader } from "@/components/admin/page-header"
import { PermissionGate } from "@/components/admin/permission-gate"
import { RowActionsMenu } from "@/components/row-actions-menu"
import { ListPagination } from "@/components/list-pagination"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ApiError, type PaginationMeta } from "@/lib/api"
import {
  createAdminCategory,
  deleteAdminCategory,
  listAdminCategories,
  type AdminCategory,
  type CategoryStatus,
} from "@/lib/api/admin/categories"
import { ADMIN_TABLE_PAGE_SIZE } from "@/lib/admin-table"
import { formatDate, slugify } from "@/lib/format"

const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  parentId: z.string().uuid().nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]),
})

type CategoryNode = AdminCategory & { children: CategoryNode[] }

function buildCategoryTree(categories: AdminCategory[]): CategoryNode[] {
  const byId = new Map<string, CategoryNode>()
  for (const category of categories) {
    byId.set(category.id, { ...category, children: [] })
  }

  const roots: CategoryNode[] = []
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const sortNodes = (nodes: CategoryNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name))
    for (const node of nodes) sortNodes(node.children)
  }
  sortNodes(roots)
  return roots
}

function flattenVisible(
  nodes: CategoryNode[],
  expanded: Set<string>,
  depth = 0
): Array<CategoryNode & { depth: number }> {
  const rows: Array<CategoryNode & { depth: number }> = []
  for (const node of nodes) {
    rows.push({ ...node, depth })
    if (node.children.length > 0 && expanded.has(node.id)) {
      rows.push(...flattenVisible(node.children, expanded, depth + 1))
    }
  }
  return rows
}

function StatusDot({
  label,
  tone = "success",
}: {
  label: string
  tone?: "success" | "muted"
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          tone === "success" ? "bg-emerald-500" : "bg-zinc-400"
        )}
      />
      {label}
    </span>
  )
}

export default function AdminCategoriesPage() {
  return (
    <PermissionGate permission="categories.read">
      <CategoriesPageContent />
    </PermissionGate>
  )
}

function CategoriesPageContent() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [parentId, setParentId] = useState("")
  const [status, setStatus] = useState<CategoryStatus>("ACTIVE")
  const [slugTouched, setSlugTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<CategoryStatus | "ALL">(
    "ALL"
  )
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [pendingDelete, setPendingDelete] = useState<CategoryNode | null>(null)
  const [page, setPage] = useState(1)
  const categoriesQuery = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: () => listAdminCategories({ pageSize: 100 }),
  })

  const categories = categoriesQuery.data?.data ?? []

  const deleteMutation = useMutation({
    mutationFn: deleteAdminCategory,
    onSuccess: async () => {
      setPendingDelete(null)
      await queryClient.invalidateQueries({ queryKey: ["admin", "categories"] })
    },
  })

  const tree = useMemo(() => buildCategoryTree(categories), [categories])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const statusMatches = (category: AdminCategory) =>
      statusFilter === "ALL" ||
      (category.status ?? "ACTIVE") === statusFilter

    if (!q && statusFilter === "ALL") {
      return flattenVisible(tree, expanded)
    }

    if (!q) {
      const filterTree = (nodes: CategoryNode[]): CategoryNode[] =>
        nodes
          .map((node) => ({
            ...node,
            children: filterTree(node.children),
          }))
          .filter(
            (node) => statusMatches(node) || node.children.length > 0
          )
      return flattenVisible(filterTree(tree), expanded)
    }

    const matches = categories.filter(
      (category) =>
        statusMatches(category) &&
        (category.name.toLowerCase().includes(q) ||
          category.slug.toLowerCase().includes(q))
    )
    return matches.map((category) => ({
      ...category,
      children: [] as CategoryNode[],
      depth: 0,
    }))
  }, [categories, expanded, search, statusFilter, tree])

  const pagination = useMemo<PaginationMeta>(() => {
    const total = filteredRows.length
    const totalPages = Math.max(1, Math.ceil(total / ADMIN_TABLE_PAGE_SIZE))
    const safePage = Math.min(page, totalPages)
    return {
      page: safePage,
      pageSize: ADMIN_TABLE_PAGE_SIZE,
      total,
      totalPages,
    }
  }, [filteredRows.length, page])

  const pagedRows = useMemo(() => {
    const start = (pagination.page - 1) * ADMIN_TABLE_PAGE_SIZE
    return filteredRows.slice(start, start + ADMIN_TABLE_PAGE_SIZE)
  }, [filteredRows, pagination.page])

  const createMutation = useMutation({
    mutationFn: createAdminCategory,
    onSuccess: async (category) => {
      closeDialog()
      await queryClient.invalidateQueries({ queryKey: ["admin", "categories"] })
      router.push(`/admin/categories/${category.id}`)
    },
    onError: (cause) => {
      setError(
        cause instanceof ApiError ? cause.message : "Failed to create category."
      )
    },
  })

  function closeDialog() {
    setDialogOpen(false)
    setName("")
    setSlug("")
    setParentId("")
    setStatus("ACTIVE")
    setSlugTouched(false)
    setError(null)
  }

  function openCreate() {
    setName("")
    setSlug("")
    setParentId("")
    setStatus("ACTIVE")
    setSlugTouched(false)
    setError(null)
    setDialogOpen(true)
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const parsed = categorySchema.safeParse({
      name: name.trim(),
      slug: (slug.trim() || slugify(name)).trim(),
      parentId: parentId || null,
      status,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input")
      return
    }
    createMutation.mutate(parsed.data)
  }

  const saving = createMutation.isPending
  const parentOptions = categories

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Categories"
        description="Organize products into a hierarchy for browsing and merchandising"
        breadcrumbs={[{ label: "Categories" }]}
        actions={
          <Button type="button" onClick={openCreate}>
            Create category
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
            placeholder="Search categories…"
          />
        }
      >
        <AdminFilterSelect
          id="category-status-filter"
          label="Status"
          value={statusFilter}
          onChange={(value) => {
            setStatusFilter(value as CategoryStatus | "ALL")
            setPage(1)
          }}
          options={[
            { value: "ALL", label: "All statuses" },
            { value: "ACTIVE", label: "Active" },
            { value: "INACTIVE", label: "Inactive" },
          ]}
        />
      </AdminFilterBar>

      <Card className="rounded-xl shadow-none ring-1 ring-border/80 [--card-spacing:--spacing(5)]">
        <CardContent className="flex flex-col gap-4 pt-5">
          {categoriesQuery.isError ? (
            <p className="text-sm text-destructive">
              {categoriesQuery.error instanceof Error
                ? categoriesQuery.error.message
                : "Failed to load categories."}
            </p>
          ) : null}

          {categoriesQuery.isLoading ? (
            <DataTableSkeleton columns={6} rows={6} />
          ) : (
            <>
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-left">
                    <tr className="border-b">
                      <th className="px-3 py-2.5 font-medium">Name</th>
                      <th className="px-3 py-2.5 font-medium">Handle</th>
                      <th className="px-3 py-2.5 font-medium">Status</th>
                      <th className="px-3 py-2.5 font-medium">Visibility</th>
                      <th className="px-3 py-2.5 font-medium">Created</th>
                      <th className="px-3 py-2.5 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-3 py-10 text-center text-muted-foreground"
                        >
                          No categories yet. Create one to get started.
                        </td>
                      </tr>
                    ) : (
                      pagedRows.map((row) => {
                        const hasChildren = row.children.length > 0
                        const isExpanded = expanded.has(row.id)
                        return (
                          <tr key={row.id} className="border-b last:border-b-0">
                            <td className="px-3 py-2.5">
                              <div
                                className="flex items-center gap-1"
                                style={{ paddingLeft: row.depth * 16 }}
                              >
                                {hasChildren && !search.trim() ? (
                                  <button
                                    type="button"
                                    className="text-muted-foreground hover:text-foreground"
                                    aria-label={
                                      isExpanded
                                        ? "Collapse category"
                                        : "Expand category"
                                    }
                                    onClick={() => toggleExpanded(row.id)}
                                  >
                                    <ChevronRight
                                      className={cn(
                                        "size-4 transition-transform",
                                        isExpanded && "rotate-90"
                                      )}
                                    />
                                  </button>
                                ) : (
                                  <span className="inline-block size-4" />
                                )}
                                <Link
                                  href={`/admin/categories/${row.id}`}
                                  className="font-medium hover:underline"
                                >
                                  {row.name}
                                </Link>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground">
                              /{row.slug}
                            </td>
                            <td className="px-3 py-2.5">
                              <StatusDot
                                label={
                                  (row.status ?? "ACTIVE") === "ACTIVE"
                                    ? "Active"
                                    : "Inactive"
                                }
                                tone={
                                  (row.status ?? "ACTIVE") === "ACTIVE"
                                    ? "success"
                                    : "muted"
                                }
                              />
                            </td>
                            <td className="px-3 py-2.5">
                              <StatusDot
                                label={
                                  (row.status ?? "ACTIVE") === "ACTIVE"
                                    ? "Public"
                                    : "Private"
                                }
                                tone={
                                  (row.status ?? "ACTIVE") === "ACTIVE"
                                    ? "success"
                                    : "muted"
                                }
                              />
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground">
                              {formatDate(row.createdAt)}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <RowActionsMenu
                                label="Category actions"
                                items={[
                                  {
                                    label: "Edit",
                                    onClick: () =>
                                      router.push(
                                        `/admin/categories/${row.id}?edit=1`
                                      ),
                                  },
                                  {
                                    label: "View",
                                    onClick: () =>
                                      router.push(`/admin/categories/${row.id}`),
                                  },
                                  {
                                    label: "Delete",
                                    variant: "destructive",
                                    disabled: deleteMutation.isPending,
                                    onClick: () => setPendingDelete(row),
                                  },
                                ]}
                              />
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <ListPagination
                pagination={pagination}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create category</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    if (!slugTouched) setSlug(slugify(e.target.value))
                  }}
                  disabled={saving}
                  placeholder="Women"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="slug">Handle</FieldLabel>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                    /
                  </span>
                  <Input
                    id="slug"
                    className="pl-6"
                    value={slug}
                    onChange={(e) => {
                      setSlugTouched(true)
                      setSlug(e.target.value)
                    }}
                    disabled={saving}
                    placeholder="women"
                  />
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="parentId">Parent category</FieldLabel>
                <select
                  id="parentId"
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  disabled={saving}
                >
                  <option value="">None (top level)</option>
                  {parentOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="status">Status</FieldLabel>
                <select
                  id="status"
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as CategoryStatus)
                  }
                  disabled={saving}
                >
                  <option value="ACTIVE">Active (Public)</option>
                  <option value="INACTIVE">Inactive (Private)</option>
                </select>
              </Field>
            </FieldGroup>
            {error ? <FieldError>{error}</FieldError> : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title="Delete category?"
        description={
          pendingDelete
            ? `Delete “${pendingDelete.name}”? This cannot be undone.`
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
