"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import {
  AdminFilterBar,
  AdminFilterSearch,
} from "@/components/admin/admin-filter-bar"
import { DataTableSkeleton } from "@/components/admin/data-table-skeleton"
import { AdminPageHeader } from "@/components/admin/page-header"
import { DataTable, type AppColumnDef } from "@/components/data-table"
import { RowActionsMenu } from "@/components/row-actions-menu"
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
import { PermissionGate } from "@/components/admin/permission-gate"
import { ApiError } from "@/lib/api"
import {
  createAdminCollection,
  deleteAdminCollection,
  listAdminCollections,
  updateAdminCollection,
  type AdminCollection,
} from "@/lib/api/admin/collections"
import { formatDate, slugify } from "@/lib/format"

const collectionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
})

export default function AdminCollectionsPage() {
  return (
    <PermissionGate permission="collections.read">
      <CollectionsPageContent />
    </PermissionGate>
  )
}

function CollectionsPageContent() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AdminCollection | null>(null)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const collectionsQuery = useQuery({
    queryKey: ["admin", "collections"],
    queryFn: () => listAdminCollections({ pageSize: 100 }),
  })

  const createMutation = useMutation({
    mutationFn: createAdminCollection,
    onSuccess: async () => {
      closeDialog()
      await queryClient.invalidateQueries({ queryKey: ["admin", "collections"] })
    },
    onError: (cause) => {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Failed to create collection."
      )
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: { name: string; slug: string }
    }) => updateAdminCollection(id, input),
    onSuccess: async () => {
      closeDialog()
      await queryClient.invalidateQueries({ queryKey: ["admin", "collections"] })
    },
    onError: (cause) => {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Failed to update collection."
      )
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteAdminCollection,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "collections"] })
    },
  })

  const filteredCollections = useMemo(() => {
    const items = collectionsQuery.data?.data ?? []
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (collection) =>
        collection.name.toLowerCase().includes(q) ||
        collection.slug.toLowerCase().includes(q)
    )
  }, [collectionsQuery.data?.data, search])

  const columns = useMemo<AppColumnDef<AdminCollection>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <Link
            href={`/admin/collections/${row.original.id}`}
            className="font-medium underline-offset-4 hover:underline"
          >
            {row.original.name}
          </Link>
        ),
      },
      { accessorKey: "slug", header: "Slug" },
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
            label="Collection actions"
            items={[
              {
                label: "View",
                onClick: () =>
                  router.push(`/admin/collections/${row.original.id}`),
              },
              {
                label: "Edit",
                onClick: () => openEdit(row.original),
              },
              {
                label: "Delete",
                variant: "destructive",
                disabled: deleteMutation.isPending,
                onClick: () => deleteMutation.mutate(row.original.id),
              },
            ]}
          />
        ),
      },
    ],
    [deleteMutation, router]
  )

  function closeDialog() {
    setDialogOpen(false)
    setEditing(null)
    setName("")
    setSlug("")
    setSlugTouched(false)
    setError(null)
  }

  function openCreate() {
    setEditing(null)
    setName("")
    setSlug("")
    setSlugTouched(false)
    setError(null)
    setDialogOpen(true)
  }

  function openEdit(collection: AdminCollection) {
    setEditing(collection)
    setName(collection.name)
    setSlug(collection.slug)
    setSlugTouched(true)
    setError(null)
    setDialogOpen(true)
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const parsed = collectionSchema.safeParse({
      name: name.trim(),
      slug: (slug.trim() || slugify(name)).trim(),
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input")
      return
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, input: parsed.data })
      return
    }
    createMutation.mutate(parsed.data)
  }

  const saving = createMutation.isPending || updateMutation.isPending

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Collections"
        description="Curated product groupings"
        breadcrumbs={[{ label: "Collections" }]}
        actions={
          <Button type="button" onClick={openCreate}>
            Create collection
          </Button>
        }
      />

      <AdminFilterBar
        dirty={search.trim() !== ""}
        onClear={() => setSearch("")}
      >
        <AdminFilterSearch
          value={search}
          onChange={setSearch}
          placeholder="Search collections…"
        />
      </AdminFilterBar>

      {collectionsQuery.isError ? (
        <p className="text-sm text-destructive">
          {collectionsQuery.error instanceof Error
            ? collectionsQuery.error.message
            : "Failed to load collections."}
        </p>
      ) : null}

      {collectionsQuery.isLoading ? (
        <DataTableSkeleton columns={4} rows={6} />
      ) : (
        <DataTable
            columns={columns}
            data={filteredCollections}
            emptyMessage={
              search.trim()
                ? "No collections match your search."
                : "No collections yet."
            }
          />
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit collection" : "Create collection"}
            </DialogTitle>
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
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="slug">Slug</FieldLabel>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true)
                    setSlug(e.target.value)
                  }}
                  disabled={saving}
                />
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
                {saving ? "Saving..." : editing ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
