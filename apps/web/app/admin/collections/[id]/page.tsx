"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { ProductStatusBadge } from "@/components/admin/products/product-status-badge"
import { DataTable, type AppColumnDef } from "@/components/data-table"
import { RowActionsMenu, type RowActionsMenuItem } from "@/components/row-actions-menu"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import { PermissionGate } from "@/components/admin/permission-gate"
import { ApiError } from "@/lib/api"
import {
  addAdminCollectionProduct,
  listAdminCollectionProducts,
  listAdminCollections,
  removeAdminCollectionProduct,
  type AdminCollectionProduct,
} from "@/lib/api/admin/collections"
import {
  listAdminProducts,
  updateAdminProduct,
  type ProductStatus,
} from "@/lib/api/admin/products"

const PRODUCT_STATUSES: ProductStatus[] = ["DRAFT", "ACTIVE", "ARCHIVED"]

function isProductStatus(value: string): value is ProductStatus {
  return PRODUCT_STATUSES.includes(value as ProductStatus)
}

function statusChangeItems(status: ProductStatus): {
  label: string
  status: ProductStatus
}[] {
  const items: { label: string; status: ProductStatus }[] = []
  if (status !== "ACTIVE") items.push({ label: "Publish", status: "ACTIVE" })
  if (status !== "DRAFT") items.push({ label: "Move to draft", status: "DRAFT" })
  if (status !== "ARCHIVED") items.push({ label: "Archive", status: "ARCHIVED" })
  return items
}

export default function AdminCollectionDetailPage() {
  return (
    <PermissionGate permission="collections.read">
      <CollectionDetailPageContent />
    </PermissionGate>
  )
}

function CollectionDetailPageContent() {
  const params = useParams<{ id: string }>()
  const collectionId = params.id
  const router = useRouter()
  const queryClient = useQueryClient()
  const [productId, setProductId] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pendingArchive, setPendingArchive] =
    useState<AdminCollectionProduct | null>(null)

  const collectionsQuery = useQuery({
    queryKey: ["admin", "collections"],
    queryFn: () => listAdminCollections({ pageSize: 100 }),
  })

  const collection = collectionsQuery.data?.data.find((c) => c.id === collectionId)

  const productsQuery = useQuery({
    queryKey: ["admin", "collections", collectionId, "products"],
    queryFn: () => listAdminCollectionProducts(collectionId),
    enabled: Boolean(collectionId),
  })

  const catalogQuery = useQuery({
    queryKey: ["admin", "products"],
    queryFn: () => listAdminProducts({ pageSize: 100 }),
  })

  const linkedIds = new Set((productsQuery.data?.data ?? []).map((p) => p.id))
  const available = (catalogQuery.data?.data ?? []).filter((p) => !linkedIds.has(p.id))

  const addMutation = useMutation({
    mutationFn: () => addAdminCollectionProduct(collectionId, productId),
    onSuccess: async () => {
      setProductId("")
      setError(null)
      await queryClient.invalidateQueries({
        queryKey: ["admin", "collections", collectionId, "products"],
      })
    },
    onError: (cause) => {
      setError(
        cause instanceof ApiError ? cause.message : "Failed to attach product."
      )
    },
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeAdminCollectionProduct(collectionId, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["admin", "collections", collectionId, "products"],
      })
    },
    onError: (cause) => {
      setError(
        cause instanceof ApiError ? cause.message : "Failed to remove product."
      )
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string
      status: ProductStatus
    }) => updateAdminProduct(id, { status }),
    onSuccess: async () => {
      setPendingArchive(null)
      setError(null)
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["admin", "collections", collectionId, "products"],
        }),
        queryClient.invalidateQueries({ queryKey: ["admin", "products"] }),
      ])
    },
    onError: (cause) => {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Failed to update product status."
      )
    },
  })

  const columns = useMemo<AppColumnDef<AdminCollectionProduct>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Product",
        cell: ({ row }) => (
          <Link
            href={`/admin/products/${row.original.id}`}
            className="font-medium underline-offset-4 hover:underline"
          >
            {row.original.title}
          </Link>
        ),
      },
      { accessorKey: "handle", header: "Handle" },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = isProductStatus(row.original.status)
            ? row.original.status
            : "DRAFT"
          return <ProductStatusBadge status={status} />
        },
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const product = row.original
          const status = isProductStatus(product.status)
            ? product.status
            : "DRAFT"
          const busy = removeMutation.isPending || statusMutation.isPending
          const items: RowActionsMenuItem[] = [
            {
              label: "Edit",
              onClick: () => router.push(`/admin/products/${product.id}`),
            },
            ...statusChangeItems(status).map((action) => ({
              label: action.label,
              disabled: busy,
              onClick: () => {
                if (action.status === "ARCHIVED") {
                  setPendingArchive(product)
                  return
                }
                statusMutation.mutate({
                  id: product.id,
                  status: action.status,
                })
              },
            })),
            {
              label: "Remove",
              variant: "destructive",
              disabled: busy,
              onClick: () => removeMutation.mutate(product.id),
            },
          ]
          return <RowActionsMenu label="Product actions" items={items} />
        },
      },
    ],
    [removeMutation.isPending, router, statusMutation]
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/admin/collections"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Back to collections
        </Link>
        <h1 className="text-2xl font-medium">
          {collection?.name ?? "Collection"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Attach products to this collection
        </p>
      </div>

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (!productId) {
            setError("Select a product")
            return
          }
          addMutation.mutate()
        }}
      >
        <div className="flex flex-col gap-1">
          <label className="text-sm text-muted-foreground" htmlFor="product">
            Product
          </label>
          <select
            id="product"
            className="h-9 min-w-64 rounded-md border bg-background px-3 text-sm"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            disabled={addMutation.isPending}
          >
            <option value="">Select product</option>
            {available.map((product) => (
              <option key={product.id} value={product.id}>
                {product.title}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={addMutation.isPending || !productId}>
          {addMutation.isPending ? "Adding..." : "Attach"}
        </Button>
      </form>
      {error ? <FieldError>{error}</FieldError> : null}

      {productsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <DataTable
          columns={columns}
          data={productsQuery.data?.data ?? []}
          emptyMessage="No products in this collection."
        />
      )}

      <ConfirmDialog
        open={pendingArchive !== null}
        onOpenChange={(open) => {
          if (!open) setPendingArchive(null)
        }}
        title="Archive product?"
        description={
          pendingArchive
            ? `${pendingArchive.title} will be hidden from the storefront. You can publish it again later.`
            : "This product will be hidden from the storefront."
        }
        confirmLabel="Archive"
        variant="warning"
        pending={statusMutation.isPending}
        onConfirm={() => {
          if (!pendingArchive) return
          statusMutation.mutate({
            id: pendingArchive.id,
            status: "ARCHIVED",
          })
        }}
      />
    </div>
  )
}
