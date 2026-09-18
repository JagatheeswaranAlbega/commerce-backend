"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import {
  AdminFilterBar,
  AdminFilterSearch,
} from "@/components/admin/admin-filter-bar"
import { DataTableSkeleton } from "@/components/admin/data-table-skeleton"
import { AdminPageHeader } from "@/components/admin/page-header"
import { PermissionGate } from "@/components/admin/permission-gate"
import {
  PlatformStoreFilter,
  usePlatformStoreFilter,
} from "@/components/admin/platform-store-filter"
import { DataTable, type AppColumnDef } from "@/components/data-table"
import { RowActionsMenu } from "@/components/row-actions-menu"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ApiError } from "@/lib/api"
import {
  createStoreAdmin,
  deleteStoreAdmin,
  listStoreAdmins,
  type PlatformStoreAdmin,
} from "@/lib/api/platform/admins"
import { listPlatformStores } from "@/lib/api/platform/stores"
import { formatDate } from "@/lib/format"

const adminSchema = z.object({
  storeId: z.string().min(1, "Select a store"),
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "At least 8 characters"),
})

export default function PlatformStoreAdminsPage() {
  return (
    <PermissionGate permission="store_admins.read">
      <StoreAdminsPageContent />
    </PermissionGate>
  )
}

function StoreAdminsPageContent() {
  const queryClient = useQueryClient()
  const { storeId, setStoreId } = usePlatformStoreFilter()
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [createStoreId, setCreateStoreId] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)

  const storesQuery = useQuery({
    queryKey: ["platform", "stores"],
    queryFn: () => listPlatformStores({ pageSize: 100 }),
  })

  const stores = storesQuery.data?.data ?? []

  const storeIdsKey = stores.map((s) => s.id).join(",")

  const adminsQuery = useQuery({
    queryKey: ["platform", "store-admins", storeId || "all", storeIdsKey],
    queryFn: async () => {
      const targetStores = storeId
        ? stores.filter((store) => store.id === storeId)
        : stores

      const results = await Promise.all(
        targetStores.map(async (store) => {
          const response = await listStoreAdmins(store.id, { pageSize: 100 })
          return (response.data ?? []).map((admin) => ({
            ...admin,
            storeId: admin.storeId || store.id,
            storeName: admin.storeName ?? store.name,
          }))
        })
      )

      return results.flat()
    },
    enabled: storesQuery.isSuccess && stores.length > 0,
  })

  const filteredAdmins = useMemo(() => {
    const items = adminsQuery.data ?? []
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((admin) => {
      const haystack = [admin.email, admin.storeName, admin.storeId]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [adminsQuery.data, search])

  const createMutation = useMutation({
    mutationFn: () =>
      createStoreAdmin(createStoreId, {
        email: email.trim(),
        password,
      }),
    onSuccess: async () => {
      closeDialog()
      await queryClient.invalidateQueries({
        queryKey: ["platform", "store-admins"],
      })
    },
    onError: (cause) => {
      setError(
        cause instanceof ApiError ? cause.message : "Failed to create admin."
      )
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (admin: PlatformStoreAdmin) =>
      deleteStoreAdmin(admin.storeId, admin.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["platform", "store-admins"],
      })
    },
  })

  const columns = useMemo<AppColumnDef<PlatformStoreAdmin>[]>(
    () => [
      { accessorKey: "email", header: "Email" },
      {
        accessorKey: "storeName",
        header: "Store",
        cell: ({ row }) =>
          row.original.storeName ??
          stores.find((s) => s.id === row.original.storeId)?.name ??
          row.original.storeId,
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
            label="Store admin actions"
            items={[
              {
                label: "Delete",
                variant: "destructive",
                disabled: deleteMutation.isPending,
                onClick: () => deleteMutation.mutate(row.original),
              },
            ]}
          />
        ),
      },
    ],
    [stores, deleteMutation]
  )

  function closeDialog() {
    setDialogOpen(false)
    setCreateStoreId("")
    setEmail("")
    setPassword("")
    setError(null)
  }

  function openCreate() {
    setCreateStoreId(storeId || "")
    setEmail("")
    setPassword("")
    setError(null)
    setDialogOpen(true)
  }

  function onCreate(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const parsed = adminSchema.safeParse({
      storeId: createStoreId,
      email: email.trim(),
      password,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input")
      return
    }
    createMutation.mutate()
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Store admins"
        description="View and provision admins across stores"
        breadcrumbs={[{ label: "Store admins" }]}
        actions={
          <Button type="button" onClick={openCreate}>
            Create admin
          </Button>
        }
      />

      <AdminFilterBar
        dirty={Boolean(storeId) || search.trim() !== ""}
        onClear={() => {
          setStoreId("")
          setSearch("")
        }}
        end={
          <AdminFilterSearch
            value={search}
            onChange={setSearch}
            placeholder="Search email…"
          />
        }
      >
        <PlatformStoreFilter value={storeId} onChange={setStoreId} />
        {storeId ? (
          <Link
            href={`/admin/stores/${storeId}`}
            className="pb-2 text-sm underline-offset-4 hover:underline"
          >
            View store
          </Link>
        ) : null}
      </AdminFilterBar>

      {adminsQuery.isError ? (
        <p className="text-sm text-destructive">
          {adminsQuery.error instanceof Error
            ? adminsQuery.error.message
            : "Failed to load admins."}
        </p>
      ) : null}

      {adminsQuery.isLoading || storesQuery.isLoading ? (
        <DataTableSkeleton columns={4} rows={6} />
      ) : (
        <DataTable
          columns={columns}
          data={filteredAdmins}
          emptyMessage={
            search.trim() || storeId
              ? "No admins match your filters."
              : "No store admins yet."
          }
        />
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create store admin</DialogTitle>
            <DialogDescription>
              Choose a store, then set the admin email and password
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onCreate} className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="create-store">Store</FieldLabel>
                <Select
                  value={createStoreId || undefined}
                  items={stores.map((store) => ({
                    value: store.id,
                    label: store.name,
                  }))}
                  onValueChange={(next) => {
                    if (next == null) return
                    setCreateStoreId(String(next))
                  }}
                >
                  <SelectTrigger id="create-store" className="w-full">
                    <SelectValue placeholder="Select store" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={createMutation.isPending}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
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
    </div>
  )
}
