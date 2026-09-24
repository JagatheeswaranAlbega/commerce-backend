"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { CopyButton } from "@/components/copy-button"
import { DataTable, type AppColumnDef } from "@/components/data-table"
import {
  AdminFilterBar,
  AdminFilterSearch,
  AdminFilterSelect,
} from "@/components/admin/admin-filter-bar"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { DataTableSkeleton } from "@/components/admin/data-table-skeleton"
import { AdminPageHeader } from "@/components/admin/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  PermissionGate,
  useAdminPermissions,
} from "@/components/admin/permission-gate"
import { RowActionsMenu, type RowActionsMenuItem } from "@/components/row-actions-menu"
import { ApiError } from "@/lib/api"
import {
  createPlatformStore,
  deletePlatformStore,
  listPlatformStores,
  updatePlatformStore,
  type CreateStoreResult,
  type PlatformStore,
} from "@/lib/api/platform/stores"
import { formatDate, slugify } from "@/lib/format"

const createStoreSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase slug format"),
})

export default function PlatformStoresPage() {
  return (
    <PermissionGate permission="stores.read">
      <StoresPageContent />
    </PermissionGate>
  )
}

function StoresPageContent() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { can } = useAdminPermissions()
  const canManage = can("stores.manage")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [pendingStatus, setPendingStatus] = useState<PlatformStore | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PlatformStore | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreateStoreResult | null>(null)

  const storesQuery = useQuery({
    queryKey: ["platform", "stores"],
    queryFn: () => listPlatformStores({ pageSize: 100 }),
  })

  const statusMutation = useMutation({
    mutationFn: ({
      storeId,
      status,
    }: {
      storeId: string
      status: "ACTIVE" | "INACTIVE"
    }) => updatePlatformStore(storeId, { status }),
    onSuccess: async () => {
      setPendingStatus(null)
      await queryClient.invalidateQueries({ queryKey: ["platform", "stores"] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (storeId: string) => deletePlatformStore(storeId),
    onSuccess: async () => {
      setPendingDelete(null)
      await queryClient.invalidateQueries({ queryKey: ["platform", "stores"] })
    },
  })

  const createMutation = useMutation({
    mutationFn: createPlatformStore,
    onSuccess: async (result) => {
      setCreated(result)
      setDialogOpen(false)
      setName("")
      setSlug("")
      setSlugTouched(false)
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ["platform", "stores"] })
      await queryClient.invalidateQueries({ queryKey: ["platform", "metrics"] })
    },
    onError: (cause) => {
      setError(cause instanceof ApiError ? cause.message : "Failed to create store.")
    },
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
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const store = row.original
          const items: RowActionsMenuItem[] = [
            {
              label: "View",
              onClick: () => router.push(`/admin/stores/${store.id}`),
            },
          ]
          if (canManage) {
            items.push({
              label: store.status === "ACTIVE" ? "Deactivate" : "Activate",
              onClick: () => setPendingStatus(store),
            })
            items.push({
              label: "Delete",
              variant: "destructive",
              disabled: deleteMutation.isPending,
              onClick: () => setPendingDelete(store),
            })
          }
          return <RowActionsMenu label="Store actions" items={items} />
        },
      },
    ],
    [canManage, deleteMutation.isPending, router]
  )

  function closeDialog() {
    setDialogOpen(false)
    setName("")
    setSlug("")
    setSlugTouched(false)
    setError(null)
  }

  function openCreate() {
    setName("")
    setSlug("")
    setSlugTouched(false)
    setError(null)
    setDialogOpen(true)
  }

  function onNameChange(value: string) {
    setName(value)
    if (!slugTouched) {
      setSlug(slugify(value))
    }
  }

  function onCreate(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const parsed = createStoreSchema.safeParse({
      name: name.trim(),
      slug: slug.trim() || slugify(name),
    })

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input")
      return
    }

    createMutation.mutate(parsed.data)
  }

  function closeKeysDialog() {
    setCreated(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Stores"
        description="All merchant stores on the platform"
        breadcrumbs={[{ label: "Stores" }]}
        actions={
          canManage ? (
            <Button type="button" onClick={openCreate}>
              Create store
            </Button>
          ) : null
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
        <DataTableSkeleton columns={6} rows={6} />
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

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create store</DialogTitle>
            <DialogDescription>
              Create a new store for a merchant.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onCreate} className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="store-name">Store name</FieldLabel>
                <Input
                  id="store-name"
                  value={name}
                  onChange={(e) => onNameChange(e.target.value)}
                  placeholder="Alora Fashion"
                  disabled={createMutation.isPending}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="store-slug">Store slug</FieldLabel>
                <Input
                  id="store-slug"
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true)
                    setSlug(e.target.value)
                  }}
                  placeholder="alora-fashion"
                  disabled={createMutation.isPending}
                />
              </Field>
            </FieldGroup>
            {error ? <FieldError>{error}</FieldError> : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(created)}
        onOpenChange={(open) => {
          if (!open) closeKeysDialog()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Store created</DialogTitle>
            <DialogDescription>
              Copy API keys now — raw secrets are only shown once
            </DialogDescription>
          </DialogHeader>
          {created ? (
            <div className="flex flex-col gap-4 text-sm">
              <div>
                <p className="font-medium">{created.store.name}</p>
                <p className="text-muted-foreground">Slug {created.store.slug}</p>
              </div>
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="font-medium">Publishable key</p>
                <div className="mt-1 flex items-start gap-2">
                  <code className="min-w-0 flex-1 break-all text-xs">
                    {created.keys.publishableKey}
                  </code>
                  <CopyButton
                    value={created.keys.publishableKey}
                    label="Copy publishable key"
                  />
                </div>
              </div>
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="font-medium">Secret key</p>
                <div className="mt-1 flex items-start gap-2">
                  <code className="min-w-0 flex-1 break-all text-xs">
                    {created.keys.secretKey}
                  </code>
                  <CopyButton
                    value={created.keys.secretKey}
                    label="Copy secret key"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeKeysDialog}>
                  Close
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    const storeId = created.store.id
                    closeKeysDialog()
                    router.push(`/admin/stores/${storeId}`)
                  }}
                >
                  Continue to store
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingStatus)}
        onOpenChange={(open) => {
          if (!open) setPendingStatus(null)
        }}
        title={
          pendingStatus?.status === "ACTIVE"
            ? "Deactivate store?"
            : "Activate store?"
        }
        description={
          pendingStatus
            ? pendingStatus.status === "ACTIVE"
              ? `Deactivate “${pendingStatus.name}”? The storefront and store admins will lose access until it is activated again.`
              : `Activate “${pendingStatus.name}”? Storefront and store admin access will resume.`
            : ""
        }
        confirmLabel={
          pendingStatus?.status === "ACTIVE" ? "Deactivate" : "Activate"
        }
        variant={pendingStatus?.status === "ACTIVE" ? "warning" : "default"}
        pending={statusMutation.isPending}
        onConfirm={() => {
          if (!pendingStatus) return
          statusMutation.mutate({
            storeId: pendingStatus.id,
            status: pendingStatus.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
          })
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title="Delete store?"
        description={
          pendingDelete
            ? `Permanently delete “${pendingDelete.name}” and all of its products, orders, customers, admins, and keys? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete store"
        variant="destructive"
        pending={deleteMutation.isPending}
        onConfirm={() => {
          if (pendingDelete) deleteMutation.mutate(pendingDelete.id)
        }}
      />
    </div>
  )
}
