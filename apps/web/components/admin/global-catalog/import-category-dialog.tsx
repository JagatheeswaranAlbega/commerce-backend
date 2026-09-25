"use client"

import { useEffect, useMemo, useState } from "react"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { listAdminCategories, type AdminCategory } from "@/lib/api/admin/categories"
import type { ImportStoreCategoryAssignment } from "@/lib/api/admin/global-catalog"
import { slugify } from "@/lib/format"
import { useQuery } from "@tanstack/react-query"

const newCategorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case."),
})

type Mode = "existing" | "new"

export function ImportCategoryDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pending = false,
  defaultCategoryName = "",
  defaultCategorySlug = "",
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel: string
  pending?: boolean
  defaultCategoryName?: string
  defaultCategorySlug?: string
  onConfirm: (assignment: ImportStoreCategoryAssignment) => void
}) {
  const categoriesQuery = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: () => listAdminCategories({ pageSize: 100 }),
    enabled: open,
  })
  const categories = useMemo(
    () =>
      (categoriesQuery.data?.data ?? []).filter(
        (category) => category.status === "ACTIVE"
      ),
    [categoriesQuery.data]
  )

  const [mode, setMode] = useState<Mode>("existing")
  const [storeCategoryId, setStoreCategoryId] = useState("")
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setSlugTouched(false)
    setName(defaultCategoryName)
    setSlug(defaultCategorySlug || slugify(defaultCategoryName))
    setStoreCategoryId("")
    setMode(categories.length > 0 ? "existing" : "new")
  }, [open, defaultCategoryName, defaultCategorySlug, categories.length])

  function close() {
    if (pending) return
    onOpenChange(false)
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (mode === "existing") {
      if (!storeCategoryId) {
        setError("Select a store category.")
        return
      }
      onConfirm({ storeCategoryId })
      return
    }

    const parsed = newCategorySchema.safeParse({
      name: name.trim(),
      slug: (slug.trim() || slugify(name)).trim(),
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid category.")
      return
    }
    onConfirm({ newCategory: parsed.data })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
          <FieldGroup>
            <Field>
              <FieldLabel>Store category</FieldLabel>
              <div className="flex flex-col gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="import-category-mode"
                    checked={mode === "existing"}
                    disabled={pending || categories.length === 0}
                    onChange={() => setMode("existing")}
                  />
                  Use existing
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="import-category-mode"
                    checked={mode === "new"}
                    disabled={pending}
                    onChange={() => setMode("new")}
                  />
                  Create new
                </label>
              </div>
            </Field>

            {mode === "existing" ? (
              <Field>
                <FieldLabel htmlFor="import-store-category">Category</FieldLabel>
                <select
                  id="import-store-category"
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  value={storeCategoryId}
                  onChange={(event) => setStoreCategoryId(event.target.value)}
                  disabled={pending || categoriesQuery.isLoading}
                >
                  <option value="">
                    {categoriesQuery.isLoading
                      ? "Loading categories…"
                      : "Select a category"}
                  </option>
                  {categories.map((category: AdminCategory) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <>
                <Field>
                  <FieldLabel htmlFor="import-category-name">Name</FieldLabel>
                  <Input
                    id="import-category-name"
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value)
                      if (!slugTouched) setSlug(slugify(event.target.value))
                    }}
                    disabled={pending}
                    placeholder="Perfumes"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="import-category-slug">Handle</FieldLabel>
                  <div className="relative">
                    <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                      /
                    </span>
                    <Input
                      id="import-category-slug"
                      className="pl-6"
                      value={slug}
                      onChange={(event) => {
                        setSlugTouched(true)
                        setSlug(event.target.value)
                      }}
                      disabled={pending}
                      placeholder="perfumes"
                    />
                  </div>
                </Field>
              </>
            )}
          </FieldGroup>
          {error ? <FieldError>{error}</FieldError> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
