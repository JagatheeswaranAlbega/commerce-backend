"use client"

import { useParams, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { z } from "zod"

import { DataTableSkeleton } from "@/components/admin/data-table-skeleton"
import { useUnsavedChangesGuard } from "@/components/admin/navigation-guard"
import { AdminPageHeader } from "@/components/admin/page-header"
import { PermissionGate, useAdminPermissions } from "@/components/admin/permission-gate"
import { ProductMediaGallery } from "@/components/admin/products/product-media-gallery"
import { ProductSectionCard } from "@/components/admin/products/product-section-card"
import { ProductStatusBadge } from "@/components/admin/products/product-status-badge"
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
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ApiError } from "@/lib/api"
import { removeAdminGlobalProductImport } from "@/lib/api/admin/global-catalog"
import { getAdminInventory } from "@/lib/api/admin/inventory"
import {
  type AdminProductDetail,
  type AdminVariant,
  type ProductStatus,
} from "@/lib/api/admin/products"
import { productMediaPath, storeCatalog } from "@/lib/api/store-catalog"
import { isPlatformScope } from "@/lib/permissions"
import { formatPaise } from "@/lib/money"
import { paiseToRupeesInput, rupeesToPaise } from "@/lib/money-input"

const productSchema = z.object({
  title: z.string().min(1),
  handle: z.string().min(1),
  shortDescription: z.string().max(500).optional(),
  description: z.string().max(5000).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
  categoryId: z.string().uuid().nullable().optional(),
})

const variantSchema = z.object({
  sku: z.string().min(1),
  title: z.string().min(1),
  pricePaise: z.number().int().nonnegative(),
  compareAtPricePaise: z.number().int().nonnegative().nullable().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
  initialQuantity: z.number().int().nonnegative().optional(),
})

export default function AdminProductDetailPage() {
  return (
    <PermissionGate permission="products.manage">
      <Suspense fallback={<DataTableSkeleton columns={3} rows={6} />}>
        <ProductDetailPageContent />
      </Suspense>
    </PermissionGate>
  )
}

function ProductDetailPageContent() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const productId = params.id
  const queryClient = useQueryClient()
  const { permissions } = useAdminPermissions()
  const platform = isPlatformScope(permissions)
  const catalogStoreId = platform ? searchParams.get("storeId") : null
  const catalog = storeCatalog({ storeId: catalogStoreId })

  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [handle, setHandle] = useState("")
  const [shortDescription, setShortDescription] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<ProductStatus>("DRAFT")
  const [categoryId, setCategoryId] = useState("")

  const [sku, setSku] = useState("")
  const [variantTitle, setVariantTitle] = useState("")
  const [priceRupees, setPriceRupees] = useState("1299")
  const [compareAtRupees, setCompareAtRupees] = useState("")
  const [initialStock, setInitialStock] = useState("25")
  const [variantStatus, setVariantStatus] = useState<ProductStatus>("ACTIVE")
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null)
  const [variantDialogOpen, setVariantDialogOpen] = useState(false)
  const [allowZeroStockPublish, setAllowZeroStockPublish] = useState(false)

  const productQuery = useQuery({
    queryKey: ["admin", "products", catalogStoreId, productId],
    queryFn: () => catalog.getProduct(productId),
    enabled: Boolean(productId) && (!platform || Boolean(catalogStoreId)),
  })

  const categoriesQuery = useQuery({
    queryKey: ["admin", "categories", catalogStoreId],
    queryFn: () => catalog.listCategories(),
    enabled: !platform || Boolean(catalogStoreId),
  })

  useEffect(() => {
    if (!productQuery.data) return
    setTitle(productQuery.data.title)
    setHandle(productQuery.data.handle)
    setShortDescription(productQuery.data.shortDescription ?? "")
    setDescription(productQuery.data.description ?? "")
    setStatus(productQuery.data.status)
    setCategoryId(productQuery.data.categoryId ?? "")
  }, [productQuery.data])

  function resetVariantForm() {
    setSku("")
    setVariantTitle("")
    setPriceRupees("1299")
    setCompareAtRupees("")
    setInitialStock("25")
    setVariantStatus("ACTIVE")
    setEditingVariantId(null)
  }

  function closeVariantDialog() {
    resetVariantForm()
    setVariantDialogOpen(false)
  }

  function openCreateVariant() {
    resetVariantForm()
    setError(null)
    setVariantDialogOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: (input?: { status?: ProductStatus }) =>
      catalog.updateProduct(productId, {
        title: title.trim(),
        handle: handle.trim(),
        shortDescription: shortDescription.trim() || null,
        description: description.trim() || null,
        status: input?.status ?? status,
        categoryId: categoryId || null,
      }),
    onSuccess: async (_data, variables) => {
      setError(null)
      if (variables?.status) setStatus(variables.status)
      setAllowZeroStockPublish(false)
      await queryClient.invalidateQueries({
        queryKey: ["admin", "products", productId],
      })
      await queryClient.invalidateQueries({ queryKey: ["admin", "products"] })
    },
    onError: (cause) => {
      setError(
        cause instanceof ApiError ? cause.message : "Failed to save product."
      )
    },
  })

  const createVariantMutation = useMutation({
    mutationFn: (input: {
      sku: string
      title: string
      pricePaise: number
      compareAtPricePaise?: number | null
      status: ProductStatus
      initialQuantity?: number
    }) => catalog.createVariant(productId, input),
    onSuccess: async () => {
      closeVariantDialog()
      setError(null)
      await queryClient.invalidateQueries({
        queryKey: ["admin", "products", productId],
      })
      await queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] })
    },
    onError: (cause) => {
      setError(
        cause instanceof ApiError ? cause.message : "Failed to create variant."
      )
    },
  })

  const updateVariantMutation = useMutation({
    mutationFn: (input: {
      variantId: string
      sku: string
      title: string
      pricePaise: number
      compareAtPricePaise?: number | null
      status: ProductStatus
    }) =>
      catalog.updateVariant(productId, input.variantId, {
        sku: input.sku,
        title: input.title,
        pricePaise: input.pricePaise,
        compareAtPricePaise: input.compareAtPricePaise,
        status: input.status,
      }),
    onSuccess: async () => {
      closeVariantDialog()
      setError(null)
      await queryClient.invalidateQueries({
        queryKey: ["admin", "products", productId],
      })
      await queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] })
    },
    onError: (cause) => {
      setError(
        cause instanceof ApiError ? cause.message : "Failed to update variant."
      )
    },
  })

  const deleteVariantMutation = useMutation({
    mutationFn: (variantId: string) =>
      catalog.deleteVariant(productId, variantId),
    onSuccess: async () => {
      if (editingVariantId) closeVariantDialog()
      await queryClient.invalidateQueries({
        queryKey: ["admin", "products", productId],
      })
    },
  })

  const uploadMutation = useMutation({
    mutationFn: (input: { file: File; altText?: string }) =>
      catalog.uploadMedia(productId, input.file, input.altText),
    onSuccess: async () => {
      setError(null)
      await queryClient.invalidateQueries({
        queryKey: ["admin", "products", productId],
      })
    },
    onError: (cause) => {
      setError(
        cause instanceof ApiError ? cause.message : "Failed to upload image."
      )
    },
  })

  const deleteMediaMutation = useMutation({
    mutationFn: catalog.deleteMedia,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["admin", "products", productId],
      })
    },
  })

  const setThumbnailMutation = useMutation({
    mutationFn: (input: { mediaId: string; isThumbnail: boolean }) =>
      catalog.setThumbnail(input.mediaId, input.isThumbnail),
    onSuccess: async () => {
      setError(null)
      await queryClient.invalidateQueries({
        queryKey: ["admin", "products", productId],
      })
      await queryClient.invalidateQueries({ queryKey: ["admin", "products"] })
    },
    onError: (cause) => {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Failed to update thumbnail."
      )
    },
  })

  const isPending =
    saveMutation.isPending ||
    createVariantMutation.isPending ||
    updateVariantMutation.isPending ||
    deleteVariantMutation.isPending ||
    uploadMutation.isPending ||
    deleteMediaMutation.isPending ||
    setThumbnailMutation.isPending

  const isDirty = useMemo(() => {
    const product = productQuery.data
    if (!product) return false

    const productFieldsDirty =
      title.trim() !== product.title ||
      handle.trim() !== product.handle ||
      shortDescription.trim() !== (product.shortDescription ?? "") ||
      description.trim() !== (product.description ?? "") ||
      status !== product.status ||
      categoryId !== (product.categoryId ?? "")

    const variantFormDirty =
      Boolean(editingVariantId) ||
      Boolean(sku.trim()) ||
      Boolean(variantTitle.trim()) ||
      priceRupees !== "1299" ||
      Boolean(compareAtRupees.trim()) ||
      initialStock !== "25"

    return productFieldsDirty || variantFormDirty
  }, [
    productQuery.data,
    title,
    handle,
    shortDescription,
    description,
    status,
    categoryId,
    editingVariantId,
    sku,
    variantTitle,
    priceRupees,
    compareAtRupees,
    initialStock,
  ])

  function validateProduct(): boolean {
    const parsed = productSchema.safeParse({
      title: title.trim(),
      handle: handle.trim(),
      shortDescription: shortDescription.trim(),
      description: description.trim(),
      status,
      categoryId: categoryId || null,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid product")
      return false
    }
    setError(null)
    return true
  }

  function onSave(nextStatus?: ProductStatus) {
    if (!validateProduct()) return
    void (async () => {
      if (nextStatus === "ACTIVE") {
        const variants = productQuery.data?.variants ?? []
        const active = variants.filter((v) => v.status === "ACTIVE")
        if (active.length === 0) {
          setError("Publish requires at least one ACTIVE variant.")
          return
        }
        try {
          const stocks = await Promise.all(
            active.map((v) => getAdminInventory(v.id).catch(() => null))
          )
          const hasStock = stocks.some((row) => (row?.availableQuantity ?? 0) > 0)
          if (!hasStock && !allowZeroStockPublish) {
            setError(
              "All ACTIVE variants have 0 stock. Adjust inventory, then publish again — or click Publish once more to publish anyway."
            )
            setAllowZeroStockPublish(true)
            return
          }
        } catch {
          // Continue if inventory lookup fails.
        }
      }
      saveMutation.mutate(nextStatus ? { status: nextStatus } : undefined)
    })()
  }

  const saveDraftOnly = useCallback(async () => {
    const parsed = productSchema.safeParse({
      title: title.trim(),
      handle: handle.trim(),
      shortDescription: shortDescription.trim(),
      description: description.trim(),
      status: "DRAFT",
      categoryId: categoryId || null,
    })
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid product"
      setError(message)
      throw new Error(message)
    }
    setError(null)
    await saveMutation.mutateAsync({ status: "DRAFT" })
  }, [
    title,
    handle,
    shortDescription,
    description,
    categoryId,
    saveMutation,
  ])

  useUnsavedChangesGuard({
    isDirty,
    onSaveAsDraft: saveDraftOnly,
    enabled: Boolean(productQuery.data),
  })

  function onAddVariant(event: React.FormEvent) {
    event.preventDefault()
    const pricePaise = rupeesToPaise(priceRupees)
    if (pricePaise === null) {
      setError("Enter a valid price in rupees.")
      return
    }
    let compareAtPricePaise: number | null | undefined
    if (compareAtRupees.trim()) {
      const parsedCompare = rupeesToPaise(compareAtRupees)
      if (parsedCompare === null) {
        setError("Enter a valid compare-at price in rupees.")
        return
      }
      compareAtPricePaise = parsedCompare
    } else if (editingVariantId) {
      compareAtPricePaise = null
    }
    const stockParsed = initialStock.trim()
      ? Number.parseInt(initialStock, 10)
      : 0
    if (
      !editingVariantId &&
      (Number.isNaN(stockParsed) || stockParsed < 0)
    ) {
      setError("Initial stock must be zero or a positive whole number.")
      return
    }
    const parsed = variantSchema.safeParse({
      sku: sku.trim(),
      title: variantTitle.trim(),
      pricePaise,
      compareAtPricePaise,
      status: variantStatus,
      initialQuantity: editingVariantId ? undefined : stockParsed,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid variant")
      return
    }
    if (editingVariantId) {
      updateVariantMutation.mutate({
        variantId: editingVariantId,
        sku: parsed.data.sku,
        title: parsed.data.title,
        pricePaise: parsed.data.pricePaise,
        compareAtPricePaise: parsed.data.compareAtPricePaise,
        status: parsed.data.status,
      })
      return
    }
    createVariantMutation.mutate({
      sku: parsed.data.sku,
      title: parsed.data.title,
      pricePaise: parsed.data.pricePaise,
      compareAtPricePaise: parsed.data.compareAtPricePaise,
      status: parsed.data.status,
      initialQuantity: parsed.data.initialQuantity,
    })
  }

  function onEditVariant(variant: AdminVariant) {
    setEditingVariantId(variant.id)
    setSku(variant.sku)
    setVariantTitle(variant.title)
    setPriceRupees(paiseToRupeesInput(variant.pricePaise))
    setCompareAtRupees(
      variant.compareAtPricePaise != null
        ? paiseToRupeesInput(variant.compareAtPricePaise)
        : ""
    )
    setVariantStatus(variant.status)
    setError(null)
    setVariantDialogOpen(true)
  }

  if (platform && !catalogStoreId) {
    return (
      <div className="flex flex-col gap-4">
        <AdminPageHeader
          title="Product"
          breadcrumbs={[
            { label: "Products", href: "/admin/products" },
            { label: "Store required" },
          ]}
        />
        <p className="text-sm text-destructive">
          Open this product from the store-filtered Products list so Super Admin
          can target a store.
        </p>
      </div>
    )
  }

  if (productQuery.isLoading) {
    return <DataTableSkeleton columns={3} rows={6} />
  }

  if (productQuery.isError || !productQuery.data) {
    return (
      <div className="flex flex-col gap-4">
        <AdminPageHeader
          title="Product"
          breadcrumbs={[
            { label: "Products", href: "/admin/products" },
            { label: "Not found" },
          ]}
        />
        <p className="text-sm text-destructive">
          {productQuery.error instanceof Error
            ? productQuery.error.message
            : "Product not found."}
        </p>
      </div>
    )
  }

  if (
    productQuery.data.source === "GLOBAL" ||
    productQuery.data.platformManaged
  ) {
    return (
      <ImportedGlobalProductDetail
        product={productQuery.data}
        productId={productId}
      />
    )
  }

  const categories = categoriesQuery.data?.data ?? []
  const variants = productQuery.data.variants ?? []
  const images = productQuery.data.images ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-20 -mx-4 bg-background/95 px-4 py-2 backdrop-blur supports-backdrop-filter:bg-background/85 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <AdminPageHeader
          title={productQuery.data.title}
          breadcrumbs={[
            { label: "Products", href: "/admin/products" },
            { label: productQuery.data.title },
          ]}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <ProductStatusBadge status={productQuery.data.status} />
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => onSave("DRAFT")}
              >
                Save as draft
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => onSave()}
              >
                {saveMutation.isPending ? "Saving..." : "Save"}
              </Button>
              {productQuery.data.status !== "ACTIVE" ? (
                <Button
                  type="button"
                  disabled={isPending}
                  onClick={() => onSave("ACTIVE")}
                >
                  Publish
                </Button>
              ) : null}
            </div>
          }
        />
      </div>

      {error && !variantDialogOpen ? <FieldError>{error}</FieldError> : null}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.85fr)_minmax(20rem,1fr)]">
        <ProductSectionCard title="General" className="order-1 lg:col-start-1">
          <dl className="grid gap-3 text-sm sm:grid-cols-[120px_1fr] sm:items-start">
            <dt className="text-muted-foreground sm:pt-2">Title</dt>
            <dd>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isPending}
              />
            </dd>
            <dt className="text-muted-foreground sm:pt-2">Handle</dt>
            <dd>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
                  /
                </span>
                <Input
                  className="pl-6"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  disabled={isPending}
                />
              </div>
            </dd>
            <dt className="text-muted-foreground sm:pt-2">Short description</dt>
            <dd>
              <textarea
                className="border-input bg-background min-h-16 w-full rounded-md border px-3 py-2 text-sm"
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                disabled={isPending}
                maxLength={500}
              />
            </dd>
            <dt className="text-muted-foreground sm:pt-2">Main description</dt>
            <dd>
              <textarea
                className="border-input bg-background min-h-20 w-full rounded-md border px-3 py-2 text-sm"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isPending}
              />
            </dd>
          </dl>
        </ProductSectionCard>

        <div className="order-2 flex flex-col gap-4 self-start lg:col-start-2 lg:row-span-2">
          <ProductSectionCard title="Media">
            <ProductMediaGallery
              compact
              images={images}
              mediaPathPrefix={productMediaPath(catalogStoreId)}
              isUploading={uploadMutation.isPending}
              isRemoving={deleteMediaMutation.isPending}
              isSettingThumbnail={setThumbnailMutation.isPending}
              disabled={isPending}
              onUpload={(file, altText) =>
                uploadMutation.mutate({ file, altText })
              }
              onRemove={(mediaId) => deleteMediaMutation.mutate(mediaId)}
              onSetThumbnail={(mediaId, isThumbnail) =>
                setThumbnailMutation.mutate({ mediaId, isThumbnail })
              }
            />
          </ProductSectionCard>

          <ProductSectionCard title="Status">
            <Field>
              <FieldLabel htmlFor="status">Product status</FieldLabel>
              <select
                id="status"
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value as ProductStatus)}
                disabled={isPending}
              >
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Published</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </Field>
          </ProductSectionCard>

          <ProductSectionCard title="Organize">
            <Field>
              <FieldLabel htmlFor="categoryId">Category</FieldLabel>
              <select
                id="categoryId"
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={isPending}
              >
                <option value="">None</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </Field>
          </ProductSectionCard>
        </div>

        <ProductSectionCard
          title="Variants"
          className="order-3 lg:col-start-1"
          action={
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {variants.length}{" "}
                {variants.length === 1 ? "variant" : "variants"}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={openCreateVariant}
              >
                <Plus />
                Add variant
              </Button>
            </div>
          }
        >
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Title</th>
                  <th className="px-3 py-2 font-medium">SKU</th>
                  <th className="px-3 py-2 font-medium">Price</th>
                  <th className="px-3 py-2 font-medium">Compare-at</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {variants.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-6 text-center text-muted-foreground"
                    >
                      No variants yet.
                    </td>
                  </tr>
                ) : (
                  variants.map((variant) => (
                    <tr key={variant.id} className="border-t">
                      <td className="px-3 py-2">{variant.title}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {variant.sku}
                      </td>
                      <td className="px-3 py-2">
                        {formatPaise(variant.pricePaise)}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {variant.compareAtPricePaise != null
                          ? formatPaise(variant.compareAtPricePaise)
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <ProductStatusBadge status={variant.status} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <RowActionsMenu
                          label="Variant actions"
                          items={[
                            {
                              label: "Edit",
                              disabled: isPending,
                              onClick: () => onEditVariant(variant),
                            },
                            {
                              label: "Delete",
                              variant: "destructive",
                              disabled: isPending,
                              onClick: () =>
                                deleteVariantMutation.mutate(variant.id),
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </ProductSectionCard>
      </div>

      <Dialog
        open={variantDialogOpen}
        onOpenChange={(open) => {
          if (open) {
            setVariantDialogOpen(true)
            return
          }
          if (isPending) return
          closeVariantDialog()
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingVariantId ? "Edit variant" : "Add variant"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onAddVariant} className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="variantTitle">Title</FieldLabel>
                <Input
                  id="variantTitle"
                  value={variantTitle}
                  onChange={(e) => setVariantTitle(e.target.value)}
                  disabled={isPending}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="sku">SKU</FieldLabel>
                <Input
                  id="sku"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  disabled={isPending}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="priceRupees">Price INR (₹)</FieldLabel>
                <Input
                  id="priceRupees"
                  type="number"
                  min="0"
                  step="0.01"
                  value={priceRupees}
                  onChange={(e) => setPriceRupees(e.target.value)}
                  disabled={isPending}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="compareAtRupees">
                  Compare-at INR (₹)
                </FieldLabel>
                <Input
                  id="compareAtRupees"
                  type="number"
                  min="0"
                  step="0.01"
                  value={compareAtRupees}
                  onChange={(e) => setCompareAtRupees(e.target.value)}
                  disabled={isPending}
                  placeholder="Optional"
                />
              </Field>
              {editingVariantId ? null : (
                <Field>
                  <FieldLabel htmlFor="initialStock">Initial stock</FieldLabel>
                  <Input
                    id="initialStock"
                    type="number"
                    min="0"
                    step="1"
                    value={initialStock}
                    onChange={(e) => setInitialStock(e.target.value)}
                    disabled={isPending}
                  />
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor="variantStatus">Status</FieldLabel>
                <select
                  id="variantStatus"
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  value={variantStatus}
                  onChange={(e) =>
                    setVariantStatus(e.target.value as ProductStatus)
                  }
                  disabled={isPending}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Published</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </Field>
            </div>
            {error ? <FieldError>{error}</FieldError> : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={closeVariantDialog}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {editingVariantId ? "Save variant" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ImportedGlobalProductDetail({
  product,
  productId,
}: {
  product: AdminProductDetail
  productId: string
}) {
  const queryClient = useQueryClient()
  const removeMutation = useMutation({
    mutationFn: () => removeAdminGlobalProductImport(productId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "products"] })
      await queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] })
      window.location.href = "/admin/products"
    },
  })

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <AdminPageHeader
        title={product.title}
        description="Imported from Global Catalog — platform managed (read-only)."
        breadcrumbs={[
          { label: "Products", href: "/admin/products" },
          { label: product.title },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <ProductStatusBadge status={product.status} />
            <Badge variant="secondary">Global Catalog · Platform Managed</Badge>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/admin/inventory" />}
            >
              Inventory
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={
                <Link href={`/admin/global-catalog/products/${productId}`} />
              }
            >
              Open in Global Catalog
            </Button>
            <Button
              variant="destructive"
              disabled={removeMutation.isPending}
              onClick={() => {
                if (
                  confirm(
                    "Remove this global product from your store? The platform master is unchanged."
                  )
                ) {
                  removeMutation.mutate()
                }
              }}
            >
              Remove from My Store
            </Button>
          </div>
        }
      />

      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Handle</dt>
          <dd>/{product.handle}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Short description</dt>
          <dd>{product.shortDescription || "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Description</dt>
          <dd className="whitespace-pre-wrap">{product.description || "—"}</dd>
        </div>
      </dl>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Variants</h2>
        <p className="text-sm text-muted-foreground">
          Prices are set by the platform. Set stock for these variants in Inventory.
        </p>
        <ul className="divide-y rounded-lg border">
          {(product.variants ?? []).map((variant) => (
            <li
              key={variant.id}
              className="flex items-center justify-between gap-4 p-4"
            >
              <div>
                <div className="font-medium">{variant.title}</div>
                <div className="text-sm text-muted-foreground">
                  {variant.sku} · {formatPaise(variant.pricePaise)}
                </div>
              </div>
              <ProductStatusBadge status={variant.status} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
