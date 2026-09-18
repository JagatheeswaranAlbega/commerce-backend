"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { DataTable, type AppColumnDef } from "@/components/data-table"
import { RowActionsMenu } from "@/components/row-actions-menu"
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
import { listAdminProducts } from "@/lib/api/admin/products"

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
  const queryClient = useQueryClient()
  const [productId, setProductId] = useState("")
  const [error, setError] = useState<string | null>(null)

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
      { accessorKey: "status", header: "Status" },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <RowActionsMenu
            label="Product actions"
            items={[
              {
                label: "Remove",
                variant: "destructive",
                disabled: removeMutation.isPending,
                onClick: () => removeMutation.mutate(row.original.id),
              },
            ]}
          />
        ),
      },
    ],
    [removeMutation]
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
    </div>
  )
}
