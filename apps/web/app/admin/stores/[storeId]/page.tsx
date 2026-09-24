"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { CopyButton } from "@/components/copy-button"
import { RowActionsMenu } from "@/components/row-actions-menu"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PermissionGate, useAdminPermissions } from "@/components/admin/permission-gate"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { ApiError } from "@/lib/api"
import {
  createStoreAdmin,
  deleteStoreAdmin,
  listStoreAdmins,
  updateStoreAdmin,
} from "@/lib/api/platform/admins"
import {
  createStoreKey,
  deleteStoreKey,
  listStoreKeys,
  type CreateApiKeyResult,
} from "@/lib/api/platform/keys"
import {
  deletePlatformStore,
  getPlatformStore,
  updatePlatformStore,
} from "@/lib/api/platform/stores"
import { formatDate } from "@/lib/format"

const adminSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "At least 8 characters"),
})

export default function PlatformStoreDetailPage() {
  return (
    <PermissionGate permission="stores.read">
      <StoreDetailPageContent />
    </PermissionGate>
  )
}

function StoreDetailPageContent() {
  const params = useParams<{ storeId: string }>()
  const storeId = params.storeId
  const router = useRouter()
  const queryClient = useQueryClient()
  const { can } = useAdminPermissions()
  const canManage = can("stores.manage")

  const [storeName, setStoreName] = useState("")
  const [adminEmail, setAdminEmail] = useState("")
  const [adminPassword, setAdminPassword] = useState("")
  const [resetPassword, setResetPassword] = useState("")
  const [resetUserId, setResetUserId] = useState<string | null>(null)
  const [adminError, setAdminError] = useState<string | null>(null)
  const [createdKey, setCreatedKey] = useState<CreateApiKeyResult | null>(null)
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const storeQuery = useQuery({
    queryKey: ["platform", "stores", storeId],
    queryFn: () => getPlatformStore(storeId),
  })

  const adminsQuery = useQuery({
    queryKey: ["platform", "stores", storeId, "admins"],
    queryFn: () => listStoreAdmins(storeId, { pageSize: 50 }),
  })

  const keysQuery = useQuery({
    queryKey: ["platform", "stores", storeId, "keys"],
    queryFn: () => listStoreKeys(storeId, { pageSize: 50 }),
  })

  const statusMutation = useMutation({
    mutationFn: (status: "ACTIVE" | "INACTIVE") =>
      updatePlatformStore(storeId, { status }),
    onSuccess: async () => {
      setStatusDialogOpen(false)
      await queryClient.invalidateQueries({
        queryKey: ["platform", "stores"],
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deletePlatformStore(storeId),
    onSuccess: async () => {
      setDeleteDialogOpen(false)
      await queryClient.invalidateQueries({
        queryKey: ["platform", "stores"],
      })
      router.push("/admin/stores")
    },
  })

  const renameMutation = useMutation({
    mutationFn: (name: string) => updatePlatformStore(storeId, { name }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["platform", "stores", storeId],
      })
    },
  })

  const createAdminMutation = useMutation({
    mutationFn: () =>
      createStoreAdmin(storeId, {
        email: adminEmail.trim(),
        password: adminPassword,
      }),
    onSuccess: async () => {
      setAdminEmail("")
      setAdminPassword("")
      setAdminError(null)
      await queryClient.invalidateQueries({
        queryKey: ["platform", "stores", storeId, "admins"],
      })
    },
    onError: (cause) => {
      setAdminError(
        cause instanceof ApiError ? cause.message : "Failed to create admin."
      )
    },
  })

  const updateAdminMutation = useMutation({
    mutationFn: ({
      userId,
      password,
      isActive,
    }: {
      userId: string
      password?: string
      isActive?: boolean
    }) => updateStoreAdmin(storeId, userId, { password, isActive }),
    onSuccess: async () => {
      setResetUserId(null)
      setResetPassword("")
      await queryClient.invalidateQueries({
        queryKey: ["platform", "stores", storeId, "admins"],
      })
    },
  })

  const deleteAdminMutation = useMutation({
    mutationFn: (userId: string) => deleteStoreAdmin(storeId, userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["platform", "stores", storeId, "admins"],
      })
    },
  })

  const createKeyMutation = useMutation({
    mutationFn: (type: "PUBLISHABLE" | "SECRET") =>
      createStoreKey(storeId, { type }),
    onSuccess: async (key) => {
      setCreatedKey(key)
      await queryClient.invalidateQueries({
        queryKey: ["platform", "stores", storeId, "keys"],
      })
    },
  })

  const revokeKeyMutation = useMutation({
    mutationFn: (keyId: string) => deleteStoreKey(storeId, keyId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["platform", "stores", storeId, "keys"],
      })
    },
  })

  function onCreateAdmin(event: React.FormEvent) {
    event.preventDefault()
    setAdminError(null)
    const parsed = adminSchema.safeParse({
      email: adminEmail.trim(),
      password: adminPassword,
    })
    if (!parsed.success) {
      setAdminError(parsed.error.issues[0]?.message ?? "Invalid input")
      return
    }
    createAdminMutation.mutate()
  }

  const store = storeQuery.data
  if (store && storeName === "" && storeQuery.isSuccess) {
    // sync once when loaded — use effect would be cleaner but avoid loops
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/admin/stores" className="underline-offset-4 hover:underline">
              Stores
            </Link>
          </p>
          <h1 className="text-2xl font-medium">
            {store?.name ?? (storeQuery.isLoading ? "Loading..." : "Store")}
          </h1>
          {store ? (
            <p className="text-sm text-muted-foreground">
              {store.slug}
              {store.domain ? ` · ${store.domain}` : ""}
            </p>
          ) : null}
          {store ? (
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              <Link
                href={`/admin/products?storeId=${store.id}`}
                className="underline-offset-4 hover:underline"
              >
                Products
              </Link>
              <Link
                href={`/admin/orders?storeId=${store.id}`}
                className="underline-offset-4 hover:underline"
              >
                Orders
              </Link>
              <Link
                href={`/admin/customers?storeId=${store.id}`}
                className="underline-offset-4 hover:underline"
              >
                Customers
              </Link>
            </div>
          ) : null}
        </div>
        {store ? (
          <div className="flex items-center gap-2">
            <Badge
              variant={store.status === "ACTIVE" ? "secondary" : "outline"}
            >
              {store.status}
            </Badge>
            {canManage ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={statusMutation.isPending}
                  onClick={() => setStatusDialogOpen(true)}
                >
                  {store.status === "ACTIVE" ? "Deactivate" : "Activate"}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deleteMutation.isPending}
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  Delete
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {storeQuery.isError ? (
        <p className="text-sm text-destructive">
          {storeQuery.error instanceof Error
            ? storeQuery.error.message
            : "Failed to load store."}
        </p>
      ) : null}

      {store ? (
        <Card>
          <CardHeader>
            <CardTitle>Store settings</CardTitle>
            <CardDescription>Rename this merchant store</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <Field className="min-w-[240px] flex-1">
              <FieldLabel htmlFor="store-name">Name</FieldLabel>
              <Input
                id="store-name"
                defaultValue={store.name}
                onChange={(e) => setStoreName(e.target.value)}
                disabled={renameMutation.isPending}
              />
            </Field>
            <Button
              type="button"
              disabled={renameMutation.isPending || !storeName.trim()}
              onClick={() => renameMutation.mutate(storeName.trim())}
            >
              {renameMutation.isPending ? "Saving..." : "Save name"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Store admins</CardTitle>
            <CardDescription>Accounts scoped to this store</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(adminsQuery.data?.data ?? []).map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell>{admin.email}</TableCell>
                    <TableCell>
                      {(admin as { isActive?: boolean }).isActive === false
                        ? "Inactive"
                        : "Active"}
                    </TableCell>
                    <TableCell className="text-right">
                      <RowActionsMenu
                        label="Store admin actions"
                        items={[
                          {
                            label: "Reset password",
                            onClick: () => {
                              setResetUserId(admin.id)
                              setResetPassword("")
                            },
                          },
                          {
                            label: "Remove",
                            variant: "destructive",
                            disabled: deleteAdminMutation.isPending,
                            onClick: () =>
                              deleteAdminMutation.mutate(admin.id),
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {(adminsQuery.data?.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      No admins yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>

            {resetUserId ? (
              <form
                className="flex flex-col gap-3 border-t pt-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (resetPassword.length < 8) return
                  updateAdminMutation.mutate({
                    userId: resetUserId,
                    password: resetPassword,
                  })
                }}
              >
                <Field>
                  <FieldLabel htmlFor="reset-password">New password</FieldLabel>
                  <Input
                    id="reset-password"
                    type="password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    minLength={8}
                  />
                </Field>
                <div className="flex gap-2">
                  <Button type="submit" disabled={updateAdminMutation.isPending}>
                    Save password
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setResetUserId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : null}

            <form onSubmit={onCreateAdmin} className="flex flex-col gap-3 border-t pt-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="admin-email">Email</FieldLabel>
                  <Input
                    id="admin-email"
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    disabled={createAdminMutation.isPending}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="admin-password">Password</FieldLabel>
                  <Input
                    id="admin-password"
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    minLength={8}
                    disabled={createAdminMutation.isPending}
                  />
                </Field>
              </FieldGroup>
              {adminError ? <FieldError>{adminError}</FieldError> : null}
              <Button type="submit" disabled={createAdminMutation.isPending}>
                {createAdminMutation.isPending ? "Creating..." : "Create admin"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API keys</CardTitle>
            <CardDescription>
              Secret keys are shown once at creation
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Prefix</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(keysQuery.data?.data ?? []).map((key) => (
                  <TableRow key={key.id}>
                    <TableCell>{key.type}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-xs">
                          {key.keyPrefix ?? key.prefix}…
                        </code>
                        <CopyButton
                          value={key.keyPrefix ?? key.prefix ?? ""}
                          label="Copy key prefix"
                          size="icon-xs"
                        />
                      </div>
                    </TableCell>
                    <TableCell>{key.status}</TableCell>
                    <TableCell className="text-right">
                      <RowActionsMenu
                        label="API key actions"
                        items={
                          key.status === "ACTIVE"
                            ? [
                                {
                                  label: "Delete",
                                  variant: "destructive",
                                  disabled: revokeKeyMutation.isPending,
                                  onClick: () =>
                                    revokeKeyMutation.mutate(key.id),
                                },
                              ]
                            : []
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {(keysQuery.data?.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      No keys yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>

            {createdKey ? (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <p className="font-medium">
                  {createdKey.type === "PUBLISHABLE"
                    ? "Publishable key"
                    : "Secret key"}{" "}
                  — copy now, it will not be shown again
                </p>
                <div className="mt-2 flex items-start gap-2">
                  <code className="min-w-0 flex-1 break-all text-xs">
                    {createdKey.rawKey}
                  </code>
                  <CopyButton
                    value={createdKey.rawKey}
                    label={
                      createdKey.type === "PUBLISHABLE"
                        ? "Copy publishable key"
                        : "Copy secret key"
                    }
                  />
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={createKeyMutation.isPending}
                onClick={() => createKeyMutation.mutate("PUBLISHABLE")}
              >
                New publishable key
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={createKeyMutation.isPending}
                onClick={() => createKeyMutation.mutate("SECRET")}
              >
                New secret key
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        title={store?.status === "ACTIVE" ? "Deactivate store?" : "Activate store?"}
        description={
          store
            ? store.status === "ACTIVE"
              ? `Deactivate “${store.name}”? The storefront and store admins will lose access until it is activated again.`
              : `Activate “${store.name}”? Storefront and store admin access will resume.`
            : ""
        }
        confirmLabel={store?.status === "ACTIVE" ? "Deactivate" : "Activate"}
        variant={store?.status === "ACTIVE" ? "warning" : "default"}
        pending={statusMutation.isPending}
        onConfirm={() => {
          if (!store) return
          statusMutation.mutate(store.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")
        }}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete store?"
        description={
          store
            ? `Permanently delete “${store.name}” and all of its products, orders, customers, admins, and keys? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete store"
        variant="destructive"
        pending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  )
}
