"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  AdminFilterBar,
  AdminFilterSearch,
} from "@/components/admin/admin-filter-bar"
import { DataTableSkeleton } from "@/components/admin/data-table-skeleton"
import { AdminPageHeader } from "@/components/admin/page-header"
import { DataTable, type AppColumnDef } from "@/components/data-table"
import { ListPagination } from "@/components/list-pagination"
import { RowActionsMenu } from "@/components/row-actions-menu"
import { Badge } from "@/components/ui/badge"
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
  listAdminInventory,
  listAdminInventoryMovements,
  setAdminInventory,
  type AdminInventoryRow,
} from "@/lib/api/admin/inventory"
import { ADMIN_TABLE_PAGE_SIZE } from "@/lib/admin-table"
import { formatDate } from "@/lib/format"

export default function AdminInventoryPage() {
  return (
    <PermissionGate permission="inventory.read">
      <InventoryPageContent />
    </PermissionGate>
  )
}

function InventoryPageContent() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<AdminInventoryRow | null>(null)
  const [historyRow, setHistoryRow] = useState<AdminInventoryRow | null>(null)
  const [quantity, setQuantity] = useState("")
  const [error, setError] = useState<string | null>(null)

  const inventoryQuery = useQuery({
    queryKey: ["admin", "inventory", page, search],
    queryFn: () =>
      listAdminInventory({
        page,
        pageSize: ADMIN_TABLE_PAGE_SIZE,
        q: search.trim() || undefined,
      }),
  })

  const movementsQuery = useQuery({
    queryKey: ["admin", "inventory", "movements", historyRow?.variantId],
    queryFn: () =>
      listAdminInventoryMovements(historyRow!.variantId, {
        page: 1,
        pageSize: 50,
      }),
    enabled: Boolean(historyRow?.variantId),
  })

  const setMutation = useMutation({
    mutationFn: ({
      variantId,
      quantity,
    }: {
      variantId: string
      quantity: number
    }) =>
      setAdminInventory(variantId, {
        quantity,
        reason: "admin-ui-set",
      }),
    onSuccess: async () => {
      setEditing(null)
      setQuantity("")
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] })
    },
    onError: (cause) => {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Failed to update inventory."
      )
    },
  })

  function closeEdit() {
    setEditing(null)
    setQuantity("")
    setError(null)
  }

  function openEdit(row: AdminInventoryRow) {
    setHistoryRow(null)
    setEditing(row)
    setQuantity(String(row.availableQuantity))
    setError(null)
  }

  function openHistory(row: AdminInventoryRow) {
    setEditing(null)
    setHistoryRow(row)
    setError(null)
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!editing) return
    const value = Number(quantity)
    if (!Number.isInteger(value) || value < 0) {
      setError("Enter a non-negative integer quantity.")
      return
    }
    setMutation.mutate({
      variantId: editing.variantId,
      quantity: value,
    })
  }

  const columns = useMemo<AppColumnDef<AdminInventoryRow>[]>(
    () => [
      {
        id: "product",
        header: "Product",
        cell: ({ row }) => (
          <div>
            <div className="font-medium">
              {row.original.productName ?? "Product"}
            </div>
            <div className="text-xs text-muted-foreground">
              {row.original.variantName}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "sku",
        header: "SKU",
        cell: ({ row }) => (
          <Badge variant="secondary">{row.original.sku ?? "—"}</Badge>
        ),
      },
      {
        accessorKey: "availableQuantity",
        header: "Available",
      },
      {
        accessorKey: "reservedQuantity",
        header: "Reserved",
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
            label="Inventory actions"
            items={[
              {
                label: "Update stock",
                onClick: () => openEdit(row.original),
              },
              {
                label: "History",
                onClick: () => openHistory(row.original),
              },
            ]}
          />
        ),
      },
    ],
    []
  )

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Inventory"
        description="Set available stock and review movement history"
        breadcrumbs={[{ label: "Inventory" }]}
      />

      <AdminFilterBar
        dirty={search.trim() !== ""}
        onClear={() => {
          setSearch("")
          setPage(1)
        }}
      >
        <AdminFilterSearch
          value={search}
          onChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          placeholder="Search product, variant, SKU…"
        />
      </AdminFilterBar>

      {inventoryQuery.isError ? (
        <p className="text-sm text-destructive">
          {inventoryQuery.error instanceof Error
            ? inventoryQuery.error.message
            : "Failed to load inventory."}
        </p>
      ) : null}

      {inventoryQuery.isLoading ? (
        <DataTableSkeleton columns={5} rows={8} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={inventoryQuery.data?.data ?? []}
            paginate={false}
            emptyMessage={
              search.trim()
                ? "No inventory rows match your search."
                : "No inventory rows yet."
            }
          />
          <ListPagination
            pagination={inventoryQuery.data?.pagination}
            onPageChange={setPage}
            disabled={inventoryQuery.isFetching}
          />
        </>
      )}

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) closeEdit()
        }}
      >
        <DialogContent>
          <form onSubmit={onSubmit}>
            <DialogHeader>
              <DialogTitle>Update stock</DialogTitle>
            </DialogHeader>
            <FieldGroup className="mt-4">
              <InventoryDialogSummary row={editing} />
              <Field>
                <FieldLabel htmlFor="inventoryQuantity">
                  Available quantity
                </FieldLabel>
                <Input
                  id="inventoryQuantity"
                  type="number"
                  min={0}
                  step={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  autoFocus
                />
                <FieldError>{error}</FieldError>
              </Field>
            </FieldGroup>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={closeEdit}>
                Cancel
              </Button>
              <Button type="submit" disabled={setMutation.isPending}>
                {setMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(historyRow)}
        onOpenChange={(open) => {
          if (!open) setHistoryRow(null)
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Inventory history</DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            <InventoryDialogSummary row={historyRow} />
          </div>
          {movementsQuery.isLoading ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
          ) : movementsQuery.isError ? (
            <p className="mt-4 text-sm text-destructive">
              {movementsQuery.error instanceof Error
                ? movementsQuery.error.message
                : "Failed to load movements."}
            </p>
          ) : (movementsQuery.data?.data.length ?? 0) === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No movements recorded yet.
            </p>
          ) : (
            <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto text-sm">
              {movementsQuery.data?.data.map((movement) => (
                <li
                  key={movement.id}
                  className="rounded-lg border border-border/80 px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{movement.type}</Badge>
                    <span className="font-medium">
                      {movement.quantity > 0 ? "+" : ""}
                      {movement.quantity}
                    </span>
                    <span className="text-muted-foreground">
                      {formatDate(movement.createdAt)}
                    </span>
                  </div>
                  {movement.reference ? (
                    <p className="mt-1 text-muted-foreground">
                      Ref: {movement.reference}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setHistoryRow(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function InventoryDialogSummary({ row }: { row: AdminInventoryRow | null }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
      <p className="font-medium">{row?.productName ?? "Product"}</p>
      <p className="text-muted-foreground">
        {row?.variantName}
        {row?.sku ? ` · ${row.sku}` : ""}
      </p>
      <p className="mt-1 text-muted-foreground">
        Available: {row?.availableQuantity ?? "—"} · Reserved:{" "}
        {row?.reservedQuantity ?? "—"}
      </p>
    </div>
  )
}
