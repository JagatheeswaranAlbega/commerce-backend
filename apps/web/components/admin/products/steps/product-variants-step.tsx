"use client"

import { useMemo } from "react"

import { DataTable, type AppColumnDef } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { AdminVariant, ProductStatus } from "@/lib/api/admin/products"
import { formatPaise } from "@/lib/money"

type ProductVariantsStepProps = {
  variants: AdminVariant[]
  sku: string
  variantTitle: string
  pricePaise: string
  variantStatus: ProductStatus
  editingVariantId: string | null
  isSaving: boolean
  isDeleting: boolean
  disabled?: boolean
  onSkuChange: (value: string) => void
  onVariantTitleChange: (value: string) => void
  onPricePaiseChange: (value: string) => void
  onVariantStatusChange: (value: ProductStatus) => void
  onEdit: (variant: AdminVariant) => void
  onDelete: (variantId: string) => void
  onCancelEdit: () => void
  onSubmit: (event: React.FormEvent) => void
}

export function ProductVariantsStep({
  variants,
  sku,
  variantTitle,
  pricePaise,
  variantStatus,
  editingVariantId,
  isSaving,
  isDeleting,
  disabled = false,
  onSkuChange,
  onVariantTitleChange,
  onPricePaiseChange,
  onVariantStatusChange,
  onEdit,
  onDelete,
  onCancelEdit,
  onSubmit,
}: ProductVariantsStepProps) {
  const variantColumns = useMemo<AppColumnDef<AdminVariant>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Variant Name",
      },
      {
        accessorKey: "sku",
        header: "SKU",
      },
      {
        accessorKey: "pricePaise",
        header: "Price",
        cell: ({ row }) => formatPaise(row.original.pricePaise),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || isSaving || isDeleting}
              onClick={() => onEdit(row.original)}
            >
              Edit
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || isSaving || isDeleting}
              onClick={() => onDelete(row.original.id)}
            >
              Delete
            </Button>
          </div>
        ),
      },
    ],
    [disabled, isDeleting, isSaving, onDelete, onEdit]
  )

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium">Variants & Pricing</h2>
        <p className="text-sm text-muted-foreground">
          Manage variant names, SKUs, and prices in paise.
        </p>
      </div>

      <DataTable
        columns={variantColumns}
        data={variants}
        emptyMessage="No variants yet."
      />

      <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-3">
        <h3 className="text-sm font-medium">
          {editingVariantId ? "Edit variant" : "Add variant"}
        </h3>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="variantTitle">Variant Name</FieldLabel>
            <Input
              id="variantTitle"
              value={variantTitle}
              onChange={(e) => onVariantTitleChange(e.target.value)}
              disabled={disabled || isSaving}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="sku">SKU</FieldLabel>
            <Input
              id="sku"
              value={sku}
              onChange={(e) => onSkuChange(e.target.value)}
              disabled={disabled || isSaving}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="pricePaise">Price (paise)</FieldLabel>
            <Input
              id="pricePaise"
              type="number"
              value={pricePaise}
              onChange={(e) => onPricePaiseChange(e.target.value)}
              disabled={disabled || isSaving}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="variantStatus">Status</FieldLabel>
            <select
              id="variantStatus"
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              value={variantStatus}
              onChange={(e) =>
                onVariantStatusChange(e.target.value as ProductStatus)
              }
              disabled={disabled || isSaving}
            >
              <option value="DRAFT">DRAFT</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
          </Field>
        </FieldGroup>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={disabled || isSaving}>
            {editingVariantId
              ? isSaving
                ? "Saving..."
                : "Save variant"
              : isSaving
                ? "Adding..."
                : "Add variant"}
          </Button>
          {editingVariantId ? (
            <Button
              type="button"
              variant="outline"
              disabled={disabled || isSaving}
              onClick={onCancelEdit}
            >
              Cancel
            </Button>
          ) : null}
          {variants.length > 0 ? (
            <Badge variant="secondary">{variants.length} variants</Badge>
          ) : null}
        </div>
      </form>
    </section>
  )
}
