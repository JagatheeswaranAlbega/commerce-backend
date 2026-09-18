"use client"

import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { AdminCategory } from "@/lib/api/admin/categories"
import type { ProductStatus } from "@/lib/api/admin/products"

type ProductDetailsStepProps = {
  title: string
  handle: string
  shortDescription: string
  description: string
  status: ProductStatus
  categoryId: string
  categories: AdminCategory[]
  disabled?: boolean
  onTitleChange: (value: string) => void
  onHandleChange: (value: string) => void
  onShortDescriptionChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onStatusChange: (value: ProductStatus) => void
  onCategoryIdChange: (value: string) => void
}

export function ProductDetailsStep({
  title,
  handle,
  shortDescription,
  description,
  status,
  categoryId,
  categories,
  disabled = false,
  onTitleChange,
  onHandleChange,
  onShortDescriptionChange,
  onDescriptionChange,
  onStatusChange,
  onCategoryIdChange,
}: ProductDetailsStepProps) {
  return (
    <section className="flex max-w-xl flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium">Basic Details</h2>
        <p className="text-sm text-muted-foreground">
          Set the product title, handle, short description, and main description.
        </p>
      </div>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="title">Title</FieldLabel>
          <Input
            id="title"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            disabled={disabled}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="handle">Handle</FieldLabel>
          <Input
            id="handle"
            value={handle}
            onChange={(e) => onHandleChange(e.target.value)}
            disabled={disabled}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="shortDescription">Short description</FieldLabel>
          <Input
            id="shortDescription"
            value={shortDescription}
            onChange={(e) => onShortDescriptionChange(e.target.value)}
            disabled={disabled}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="description">Main description</FieldLabel>
          <Input
            id="description"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            disabled={disabled}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="status">Status</FieldLabel>
          <select
            id="status"
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            value={status}
            onChange={(e) => onStatusChange(e.target.value as ProductStatus)}
            disabled={disabled}
          >
            <option value="DRAFT">DRAFT</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor="categoryId">Category</FieldLabel>
          <select
            id="categoryId"
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            value={categoryId}
            onChange={(e) => onCategoryIdChange(e.target.value)}
            disabled={disabled}
          >
            <option value="">None</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>
      </FieldGroup>
    </section>
  )
}
