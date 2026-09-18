"use client"

import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { cn } from "cn"

import { PermissionGate } from "@/components/admin/permission-gate"
import { ProductSectionCard } from "@/components/admin/products/product-section-card"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ApiError } from "@/lib/api"
import {
  listAdminCategories,
  updateAdminCategory,
  type CategoryStatus,
} from "@/lib/api/admin/categories"
import { listAdminProducts } from "@/lib/api/admin/products"
import { slugify } from "@/lib/format"

const categorySchema = z.object({
  name: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Handle is required"),
  status: z.enum(["ACTIVE", "INACTIVE"]),
})

function StatusDot({
  label,
  tone = "success",
}: {
  label: string
  tone?: "success" | "muted"
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          tone === "success" ? "bg-emerald-500" : "bg-zinc-400"
        )}
      />
      {label}
    </span>
  )
}

function CategoryDetailPageContent() {
  const params = useParams<{ id: string }>()
  const categoryId = params.id
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()

  const [editOpen, setEditOpen] = useState(false)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [status, setStatus] = useState<CategoryStatus>("ACTIVE")
  const [visibility, setVisibility] = useState<"public" | "private">("public")
  const [error, setError] = useState<string | null>(null)

  const categoriesQuery = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: () => listAdminCategories({ pageSize: 100 }),
  })

  const category = categoriesQuery.data?.data.find((c) => c.id === categoryId)
  const categoryStatus = category?.status ?? "ACTIVE"

  const productsQuery = useQuery({
    queryKey: ["admin", "products", "by-category", categoryId],
    queryFn: () =>
      listAdminProducts({ pageSize: 50, categoryId }),
    enabled: Boolean(categoryId),
  })

  useEffect(() => {
    if (searchParams.get("edit") === "1") {
      setEditOpen(true)
    }
  }, [searchParams])

  useEffect(() => {
    if (!category) return
    setName(category.name)
    setSlug(category.slug)
    setSlugTouched(true)
    setStatus(category.status ?? "ACTIVE")
    setVisibility(
      (category.status ?? "ACTIVE") === "ACTIVE" ? "public" : "private"
    )
  }, [category])

  function closeEdit() {
    setEditOpen(false)
    setError(null)
    if (searchParams.get("edit") === "1") {
      router.replace(`/admin/categories/${categoryId}`)
    }
  }

  function openEdit() {
    if (!category) return
    setName(category.name)
    setSlug(category.slug)
    setSlugTouched(true)
    setStatus(category.status ?? "ACTIVE")
    setVisibility(
      (category.status ?? "ACTIVE") === "ACTIVE" ? "public" : "private"
    )
    setError(null)
    setEditOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const parsed = categorySchema.safeParse({
        name: name.trim(),
        slug: (slug.trim() || slugify(name)).trim(),
        status:
          status === "ACTIVE" && visibility === "public"
            ? "ACTIVE"
            : "INACTIVE",
      })
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Invalid category")
      }
      return updateAdminCategory(categoryId, parsed.data)
    },
    onSuccess: async () => {
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ["admin", "categories"] })
      closeEdit()
    },
    onError: (cause) => {
      setError(
        cause instanceof ApiError || cause instanceof Error
          ? cause.message
          : "Failed to save category."
      )
    },
  })

  if (categoriesQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>
  }

  if (!category) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-destructive">Category not found.</p>
        <Button
          type="button"
          variant="outline"
          nativeButton={false}
          render={<Link href="/admin/categories" />}
        >
          Back to categories
        </Button>
      </div>
    )
  }

  const products = productsQuery.data?.data ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <nav className="mb-1 text-sm text-muted-foreground">
            <Link href="/admin/categories" className="hover:underline">
              Categories
            </Link>
            <span className="mx-1.5">/</span>
            <span className="text-foreground">{category.name}</span>
          </nav>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-medium tracking-tight">
              {category.name}
            </h1>
            <StatusDot
              label={categoryStatus === "ACTIVE" ? "Active" : "Inactive"}
              tone={categoryStatus === "ACTIVE" ? "success" : "muted"}
            />
            <StatusDot
              label={categoryStatus === "ACTIVE" ? "Public" : "Private"}
              tone={categoryStatus === "ACTIVE" ? "success" : "muted"}
            />
          </div>
        </div>
        <Button type="button" onClick={openEdit}>
          Edit
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        <ProductSectionCard title={category.name}>
          <dl className="grid gap-4 text-sm sm:grid-cols-[140px_1fr]">
            <dt className="text-muted-foreground">Handle</dt>
            <dd className="text-muted-foreground">/{category.slug}</dd>
            <dt className="text-muted-foreground">Status</dt>
            <dd>
              <StatusDot
                label={categoryStatus === "ACTIVE" ? "Active" : "Inactive"}
                tone={categoryStatus === "ACTIVE" ? "success" : "muted"}
              />
            </dd>
            <dt className="text-muted-foreground">Visibility</dt>
            <dd>
              <StatusDot
                label={categoryStatus === "ACTIVE" ? "Public" : "Private"}
                tone={categoryStatus === "ACTIVE" ? "success" : "muted"}
              />
            </dd>
          </dl>
        </ProductSectionCard>

        <ProductSectionCard
          title="Products"
          action={
            <span className="text-xs text-muted-foreground">
              {productsQuery.data?.pagination?.total ?? products.length}{" "}
              {(productsQuery.data?.pagination?.total ?? products.length) === 1
                ? "product"
                : "products"}
            </span>
          }
        >
          {productsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
              <p className="text-sm font-medium">No records</p>
              <p className="text-sm text-muted-foreground">
                There are no products in this category.
              </p>
            </div>
          ) : (
            <ul className="divide-y rounded-lg border">
              {products.map((product) => (
                <li key={product.id}>
                  <Link
                    href={`/admin/products/${product.id}`}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-muted/40"
                  >
                    <span className="font-medium">{product.title}</span>
                    <span className="text-muted-foreground">
                      /{product.handle}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ProductSectionCard>
      </div>

      <Sheet
        open={editOpen}
        onOpenChange={(open) => {
          if (open) openEdit()
          else closeEdit()
        }}
      >
        <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
          <SheetHeader className="border-b pr-12">
            <SheetTitle>Edit Category</SheetTitle>
            <SheetDescription>
              Update how this category appears in your catalog.
            </SheetDescription>
          </SheetHeader>

          <form
            className="flex flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault()
              saveMutation.mutate()
            }}
          >
            <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="edit-title">Title</FieldLabel>
                  <Input
                    id="edit-title"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      if (!slugTouched) setSlug(slugify(e.target.value))
                    }}
                    disabled={saveMutation.isPending}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="edit-handle">Handle</FieldLabel>
                  <div className="flex overflow-hidden rounded-md border">
                    <span className="bg-muted flex items-center border-r px-3 text-sm text-muted-foreground">
                      /
                    </span>
                    <Input
                      id="edit-handle"
                      className="rounded-none border-0 shadow-none focus-visible:ring-0"
                      value={slug}
                      onChange={(e) => {
                        setSlugTouched(true)
                        setSlug(e.target.value)
                      }}
                      disabled={saveMutation.isPending}
                    />
                  </div>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="edit-status">Status</FieldLabel>
                    <select
                      id="edit-status"
                      className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                      value={status}
                      onChange={(e) => {
                        const next = e.target.value as CategoryStatus
                        setStatus(next)
                        setVisibility(
                          next === "ACTIVE" ? "public" : "private"
                        )
                      }}
                      disabled={saveMutation.isPending}
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="edit-visibility">Visibility</FieldLabel>
                    <select
                      id="edit-visibility"
                      className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                      value={visibility}
                      onChange={(e) => {
                        const next = e.target.value as "public" | "private"
                        setVisibility(next)
                        setStatus(next === "public" ? "ACTIVE" : "INACTIVE")
                      }}
                      disabled={saveMutation.isPending}
                    >
                      <option value="public">Public</option>
                      <option value="private">Private</option>
                    </select>
                  </Field>
                </div>
              </FieldGroup>
              {error ? <FieldError>{error}</FieldError> : null}
            </div>

            <SheetFooter className="flex-row justify-end gap-2 border-t">
              <Button
                type="button"
                variant="outline"
                disabled={saveMutation.isPending}
                onClick={closeEdit}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}

export default function CategoryDetailPage() {
  return (
    <PermissionGate permission="categories.read">
      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Loading...</p>}
      >
        <CategoryDetailPageContent />
      </Suspense>
    </PermissionGate>
  )
}
