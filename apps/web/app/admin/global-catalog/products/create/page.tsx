"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import {
  useUnsavedChangesGuard,
} from "@/components/admin/navigation-guard"
import { CreateProductStepper } from "@/components/admin/products/create-product-stepper"
import { ProductMediaGallery } from "@/components/admin/products/product-media-gallery"
import {
  CREATE_STEP_MAX,
  parseCreateProductStep,
  type CreateProductStepId,
} from "@/components/admin/products/product-steps"
import { PermissionGate } from "@/components/admin/permission-gate"
import { RowActionsMenu } from "@/components/row-actions-menu"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ApiError } from "@/lib/api"
import {
  createPlatformGlobalProduct,
  createPlatformGlobalVariant,
  deletePlatformGlobalProductMedia,
  deletePlatformGlobalVariant,
  getPlatformGlobalProduct,
  listPlatformGlobalCategories,
  setPlatformGlobalProductMediaThumbnail,
  updatePlatformGlobalProduct,
  updatePlatformGlobalVariant,
  uploadPlatformGlobalProductMedia,
  type GlobalProductStatus,
  type GlobalVariant,
} from "@/lib/api/platform/global-catalog"
import { slugify } from "@/lib/format"
import {
  globalCategoryById,
  globalCategorySelectOptions,
  topLevelCategoryId,
} from "@/lib/global-category-label"
import { formatPaise } from "@/lib/money"
import { paiseToRupeesInput, rupeesToPaise } from "@/lib/money-input"

const PLATFORM_MEDIA_PATH = "/api/v1/platform/global-media"
const CATALOG_LIST_HREF = "/admin/global-catalog"

const detailsSchema = z.object({
  title: z.string().min(1, "Title is required"),
  handle: z.string().min(1, "Handle is required"),
  shortDescription: z.string().max(500).optional(),
  description: z.string().max(5000).optional(),
})

const variantSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  title: z.string().min(1, "Variant title is required"),
  pricePaise: z.number().int().nonnegative(),
  compareAtPricePaise: z.number().int().nonnegative().nullable().optional(),
})

function CreateGlobalProductPageContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()

  const currentStep = parseCreateProductStep(searchParams.get("step"))
  const urlProductId = searchParams.get("id")
  const [localProductId, setLocalProductId] = useState<string | null>(null)
  const productId = urlProductId ?? localProductId

  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [handle, setHandle] = useState("")
  const [handleTouched, setHandleTouched] = useState(false)
  const [shortDescription, setShortDescription] = useState("")
  const [description, setDescription] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [status, setStatus] = useState<GlobalProductStatus>("DRAFT")
  const [hasVariants, setHasVariants] = useState(true)

  const [sku, setSku] = useState("")
  const [variantTitle, setVariantTitle] = useState("Default variant")
  const [priceRupees, setPriceRupees] = useState("1299")
  const [compareAtRupees, setCompareAtRupees] = useState("")
  const [variantStatus, setVariantStatus] = useState<GlobalProductStatus>("ACTIVE")
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null)

  const productQuery = useQuery({
    queryKey: ["platform", "global-product", productId],
    queryFn: () => getPlatformGlobalProduct(productId!),
    enabled: Boolean(productId),
  })

  const categoriesQuery = useQuery({
    queryKey: ["platform", "global-categories"],
    queryFn: () => listPlatformGlobalCategories(),
  })

  useEffect(() => {
    if (urlProductId) setLocalProductId(urlProductId)
  }, [urlProductId])

  useEffect(() => {
    if (!productQuery.data) return
    setTitle(productQuery.data.title)
    setHandle(productQuery.data.handle)
    setHandleTouched(true)
    setShortDescription(productQuery.data.shortDescription ?? "")
    setDescription(productQuery.data.description ?? "")
    setCategoryId(productQuery.data.categoryId ?? "")
    setStatus(productQuery.data.status)
  }, [productQuery.data])

  function setStep(step: CreateProductStepId, id?: string | null) {
    const next = new URLSearchParams()
    next.set("step", String(step))
    const resolvedId = id ?? productId
    if (resolvedId) {
      next.set("id", resolvedId)
      setLocalProductId(resolvedId)
    }
    router.replace(`${pathname}?${next.toString()}`)
  }

  const isDirty = useMemo(() => {
    const product = productQuery.data
    const variantFormDirty =
      Boolean(editingVariantId) ||
      Boolean(sku.trim()) ||
      variantTitle.trim() !== "Default variant" ||
      priceRupees !== "1299" ||
      Boolean(compareAtRupees.trim())

    if (!product) {
      return (
        Boolean(title.trim()) ||
        Boolean(handle.trim()) ||
        Boolean(shortDescription.trim()) ||
        Boolean(description.trim()) ||
        Boolean(categoryId) ||
        status !== "DRAFT" ||
        !hasVariants ||
        variantFormDirty
      )
    }

    return (
      title.trim() !== product.title ||
      handle.trim() !== product.handle ||
      shortDescription.trim() !== (product.shortDescription ?? "") ||
      description.trim() !== (product.description ?? "") ||
      categoryId !== (product.categoryId ?? "") ||
      status !== product.status ||
      variantFormDirty
    )
  }, [
    productQuery.data,
    title,
    handle,
    shortDescription,
    description,
    categoryId,
    status,
    hasVariants,
    editingVariantId,
    sku,
    variantTitle,
    priceRupees,
    compareAtRupees,
  ])

  function parseDetails() {
    return detailsSchema.safeParse({
      title: title.trim(),
      handle: (handle.trim() || slugify(title)).trim(),
      shortDescription: shortDescription.trim(),
      description: description.trim(),
    })
  }

  async function ensureDraftProduct(): Promise<string> {
    if (productId) return productId

    const parsed = parseDetails()
    if (!parsed.success) {
      throw new Error(
        parsed.error.issues[0]?.message ??
          "Enter a title before uploading images."
      )
    }

    const product = await createPlatformGlobalProduct({
      ...parsed.data,
      shortDescription: parsed.data.shortDescription || null,
      description: parsed.data.description || null,
      status: "DRAFT",
    })
    setLocalProductId(product.id)
    setStep(currentStep, product.id)
    await queryClient.invalidateQueries({ queryKey: ["platform", "global-products"] })
    return product.id
  }

  const saveDetailsMutation = useMutation({
    mutationFn: async (nextStatus: GlobalProductStatus) => {
      const parsed = parseDetails()
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Invalid details")
      }

      if (productId) {
        return updatePlatformGlobalProduct(productId, {
          ...parsed.data,
          shortDescription: parsed.data.shortDescription || null,
          description: parsed.data.description || null,
          status: nextStatus,
        })
      }

      return createPlatformGlobalProduct({
        ...parsed.data,
        shortDescription: parsed.data.shortDescription || null,
        description: parsed.data.description || null,
        status: nextStatus,
      })
    },
    onError: (cause) => {
      setError(
        cause instanceof ApiError || cause instanceof Error
          ? cause.message
          : "Failed to save product."
      )
    },
  })

  const saveOrganizeMutation = useMutation({
    mutationFn: async () => {
      if (!productId) throw new Error("Create product details first.")
      return updatePlatformGlobalProduct(productId, {
        categoryId: categoryId || null,
        status,
      })
    },
    onError: (cause) => {
      setError(
        cause instanceof ApiError ? cause.message : "Failed to save organize."
      )
    },
  })

  const createVariantMutation = useMutation({
    mutationFn: (input: {
      sku: string
      title: string
      pricePaise: number
      compareAtPricePaise?: number | null
      status: GlobalProductStatus
    }) => createPlatformGlobalVariant(productId!, input),
    onSuccess: async () => {
      resetVariantForm()
      setError(null)
      await queryClient.invalidateQueries({
        queryKey: ["platform", "global-product", productId],
      })
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
      status: GlobalProductStatus
    }) =>
      updatePlatformGlobalVariant(productId!, input.variantId, {
        sku: input.sku,
        title: input.title,
        pricePaise: input.pricePaise,
        compareAtPricePaise: input.compareAtPricePaise,
        status: input.status,
      }),
    onSuccess: async () => {
      resetVariantForm()
      setError(null)
      await queryClient.invalidateQueries({
        queryKey: ["platform", "global-product", productId],
      })
    },
    onError: (cause) => {
      setError(
        cause instanceof ApiError ? cause.message : "Failed to update variant."
      )
    },
  })

  const deleteVariantMutation = useMutation({
    mutationFn: (variantId: string) =>
      deletePlatformGlobalVariant(productId!, variantId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["platform", "global-product", productId],
      })
    },
  })

  const uploadMutation = useMutation({
    mutationFn: async (input: { file: File; altText?: string }) => {
      const id = await ensureDraftProduct()
      return uploadPlatformGlobalProductMedia(id, input.file, input.altText)
    },
    onSuccess: async (image) => {
      setError(null)
      setLocalProductId(image.productId)
      await queryClient.invalidateQueries({
        queryKey: ["platform", "global-product", image.productId],
      })
      await queryClient.invalidateQueries({ queryKey: ["platform", "global-products"] })
    },
    onError: (cause) => {
      setError(
        cause instanceof ApiError || cause instanceof Error
          ? cause.message
          : "Failed to upload image."
      )
    },
  })

  const deleteMediaMutation = useMutation({
    mutationFn: deletePlatformGlobalProductMedia,
    onSuccess: async () => {
      if (!productId) return
      await queryClient.invalidateQueries({
        queryKey: ["platform", "global-product", productId],
      })
    },
    onError: (cause) => {
      setError(
        cause instanceof ApiError ? cause.message : "Failed to remove image."
      )
    },
  })

  const setThumbnailMutation = useMutation({
    mutationFn: (input: { mediaId: string; isThumbnail: boolean }) =>
      setPlatformGlobalProductMediaThumbnail(
        productId!,
        input.mediaId,
        input.isThumbnail
      ),
    onSuccess: async () => {
      setError(null)
      if (!productId) return
      await queryClient.invalidateQueries({
        queryKey: ["platform", "global-product", productId],
      })
      await queryClient.invalidateQueries({ queryKey: ["platform", "global-products"] })
    },
    onError: (cause) => {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Failed to update thumbnail."
      )
    },
  })

  const publishMutation = useMutation({
    mutationFn: () =>
      updatePlatformGlobalProduct(productId!, { status: "ACTIVE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["platform", "global-products"] })
      router.push(CATALOG_LIST_HREF)
    },
    onError: (cause) => {
      setError(
        cause instanceof ApiError ? cause.message : "Failed to publish product."
      )
    },
  })

  const saveDraftOnly = useCallback(async () => {
    if (currentStep === 1) {
      const product = await saveDetailsMutation.mutateAsync("DRAFT")
      setLocalProductId(product.id)
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ["platform", "global-products"] })
      await queryClient.invalidateQueries({
        queryKey: ["platform", "global-product", product.id],
      })
      return
    }
    if (!productId) {
      const message = "Nothing to save yet."
      setError(message)
      throw new Error(message)
    }
    if (currentStep === 2) {
      await saveOrganizeMutation.mutateAsync()
      setError(null)
      await queryClient.invalidateQueries({
        queryKey: ["platform", "global-product", productId],
      })
      return
    }
    await updatePlatformGlobalProduct(productId, { status: "DRAFT" })
    setStatus("DRAFT")
    setError(null)
    await queryClient.invalidateQueries({
      queryKey: ["platform", "global-product", productId],
    })
  }, [
    currentStep,
    productId,
    queryClient,
    saveDetailsMutation,
    saveOrganizeMutation,
  ])

  const { confirmLeave } = useUnsavedChangesGuard({
    isDirty,
    onSaveAsDraft: saveDraftOnly,
  })

  function closeWizard() {
    confirmLeave({ href: CATALOG_LIST_HREF })
  }

  function resetVariantForm() {
    setSku("")
    setVariantTitle("Default variant")
    setPriceRupees("1299")
    setCompareAtRupees("")
    setVariantStatus("ACTIVE")
    setEditingVariantId(null)
  }

  function onEditVariant(variant: GlobalVariant) {
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
  }

  function onSubmitVariant(event: React.FormEvent) {
    event.preventDefault()
    if (!productId) {
      setError("Save product details before adding variants.")
      return
    }
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
    const parsed = variantSchema.safeParse({
      sku: sku.trim(),
      title: variantTitle.trim(),
      pricePaise,
      compareAtPricePaise,
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
        status: variantStatus,
      })
      return
    }
    createVariantMutation.mutate({
      sku: parsed.data.sku,
      title: parsed.data.title,
      pricePaise: parsed.data.pricePaise,
      compareAtPricePaise: parsed.data.compareAtPricePaise,
      status: variantStatus,
    })
  }

  async function onSaveDraft() {
    try {
      await saveDraftOnly()
      if (currentStep === 1 && productId) {
        setStep(1, productId)
      }
    } catch {
      // Error already set
    }
  }

  async function onContinue() {
    try {
      if (currentStep === 1) {
        const product = await saveDetailsMutation.mutateAsync(status)
        setLocalProductId(product.id)
        setError(null)
        await queryClient.invalidateQueries({
          queryKey: ["platform", "global-products"],
        })
        await queryClient.invalidateQueries({
          queryKey: ["platform", "global-product", product.id],
        })
        setStep(2, product.id)
        return
      }
      if (currentStep === 2) {
        if (!productId) {
          setError("Save product details first.")
          return
        }
        await saveOrganizeMutation.mutateAsync()
        setError(null)
        await queryClient.invalidateQueries({
          queryKey: ["platform", "global-product", productId],
        })
        setStep(3, productId)
      }
    } catch {
      // Error already set
    }
  }

  async function onPublish() {
    if (!productId) {
      setError("Save product details before publishing.")
      return
    }

    const variants = productQuery.data?.variants ?? []

    async function publishWithGuards(list: GlobalVariant[]) {
      if (list.length === 0) {
        setError("Add at least one variant before publishing.")
        return
      }
      const hasActive = list.some((variant) => variant.status === "ACTIVE")
      if (!hasActive) {
        setError("Publish at least one active variant before publishing the product.")
        return
      }
      publishMutation.mutate()
    }

    if (!hasVariants && variants.length === 0) {
      const pricePaise = rupeesToPaise(priceRupees) ?? 0
      const defaultSku =
        sku.trim() || `${handle.trim() || slugify(title)}-default`
      let compareAtPricePaise: number | null | undefined
      if (compareAtRupees.trim()) {
        compareAtPricePaise = rupeesToPaise(compareAtRupees)
      }
      createVariantMutation.mutate(
        {
          sku: defaultSku,
          title: variantTitle.trim() || "Default variant",
          pricePaise,
          compareAtPricePaise:
            compareAtPricePaise === null ? undefined : compareAtPricePaise,
          status: variantStatus,
        },
        {
          onSuccess: async () => {
            const refreshed = await getPlatformGlobalProduct(productId)
            await publishWithGuards(refreshed.variants ?? [])
          },
        }
      )
      return
    }
    await publishWithGuards(variants)
  }

  useEffect(() => {
    if (currentStep > 1 && !productId) {
      const next = new URLSearchParams()
      next.set("step", "1")
      router.replace(`${pathname}?${next.toString()}`)
    }
  }, [currentStep, productId, pathname, router])

  const isPending =
    saveDetailsMutation.isPending ||
    saveOrganizeMutation.isPending ||
    createVariantMutation.isPending ||
    updateVariantMutation.isPending ||
    deleteVariantMutation.isPending ||
    uploadMutation.isPending ||
    deleteMediaMutation.isPending ||
    setThumbnailMutation.isPending ||
    publishMutation.isPending

  const categories = categoriesQuery.data ?? []
  const categoryById = globalCategoryById(categories)
  const categoryOptions = globalCategorySelectOptions(categories)
  const selectedCategoryId = topLevelCategoryId(categoryId, categoryById)
  const variants = productQuery.data?.variants ?? []
  const images = productQuery.data?.images ?? []
  const checklist = {
    details: Boolean(title.trim()),
    media: images.length > 0,
    category: Boolean(categoryId),
    variants: variants.length > 0,
  }

  return (
    <div className="-m-6 flex min-h-[calc(100vh-3.5rem)] flex-col bg-background">
      <CreateProductStepper currentStep={currentStep} onClose={closeWizard} />

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-8">
        {error ? <FieldError>{error}</FieldError> : null}

        {currentStep === 1 ? (
          <section className="flex flex-col gap-8">
            <div>
              <h2 className="text-lg font-medium">General</h2>
              <p className="text-sm text-muted-foreground">
                Title, handle, and descriptions.
              </p>
            </div>
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="title">Title</FieldLabel>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value)
                      if (!handleTouched) setHandle(slugify(e.target.value))
                    }}
                    disabled={isPending}
                    placeholder="Winter jacket"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="handle">Handle</FieldLabel>
                  <div className="relative">
                    <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                      /
                    </span>
                    <Input
                      id="handle"
                      className="pl-6"
                      value={handle}
                      onChange={(e) => {
                        setHandleTouched(true)
                        setHandle(e.target.value)
                      }}
                      disabled={isPending}
                    />
                  </div>
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="shortDescription">
                  Short description
                </FieldLabel>
                <textarea
                  id="shortDescription"
                  className="border-input bg-background min-h-20 w-full rounded-md border px-3 py-2 text-sm"
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  disabled={isPending}
                  maxLength={500}
                  placeholder="A warm jacket for everyday wear"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="description">Main description</FieldLabel>
                <textarea
                  id="description"
                  className="border-input bg-background min-h-36 w-full rounded-md border px-3 py-2 text-sm"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isPending}
                  placeholder="Fabric, fit, care, and other product details"
                />
              </Field>
            </FieldGroup>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-border/80 bg-card px-4 py-3 shadow-sm">
              <div>
                <p className="text-sm font-medium">
                  Yes, this is a product with variants
                </p>
                <p className="text-xs text-muted-foreground">
                  Turn off for a single default SKU. Use variants for sizes like
                  S, M, L with different prices.
                </p>
              </div>
              <input
                type="checkbox"
                className="size-4 accent-foreground"
                checked={hasVariants}
                onChange={(e) => setHasVariants(e.target.checked)}
                disabled={isPending}
              />
            </div>
          </section>
        ) : null}

        {currentStep === 2 ? (
          <section className="flex flex-col gap-8">
            <div>
              <h2 className="text-lg font-medium">Organize</h2>
              <p className="text-sm text-muted-foreground">
                Category, visibility, and product images.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="categoryId">Category</FieldLabel>
                <select
                  id="categoryId"
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  value={selectedCategoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  disabled={isPending}
                >
                  <option value="">None</option>
                  {categoryOptions.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Manage categories from the Global Catalog page.
                </p>
              </Field>

              <Field>
                <FieldLabel htmlFor="status">Visibility status</FieldLabel>
                <select
                  id="status"
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as GlobalProductStatus)
                  }
                  disabled={isPending}
                >
                  <option value="DRAFT">Draft — not visible to stores</option>
                  <option value="ACTIVE">Active — ready to import</option>
                  <option value="ARCHIVED">Archived — hidden from catalog</option>
                </select>
              </Field>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-sm font-medium">Media</h3>
                <p className="text-sm text-muted-foreground">
                  Product thumbnails and gallery images.
                </p>
              </div>
              <ProductMediaGallery
                images={images}
                mediaPathPrefix={PLATFORM_MEDIA_PATH}
                isUploading={uploadMutation.isPending}
                isRemoving={deleteMediaMutation.isPending}
                isSettingThumbnail={setThumbnailMutation.isPending}
                disabled={
                  saveDetailsMutation.isPending ||
                  deleteMediaMutation.isPending ||
                  setThumbnailMutation.isPending
                }
                onUpload={(file, altText) =>
                  uploadMutation.mutate({ file, altText })
                }
                onRemove={(mediaId) => {
                  if (!productId) {
                    setError("Save the product before removing images.")
                    return
                  }
                  deleteMediaMutation.mutate(mediaId)
                }}
                onSetThumbnail={(mediaId, isThumbnail) => {
                  if (!productId) {
                    setError("Save the product before setting a thumbnail.")
                    return
                  }
                  setThumbnailMutation.mutate({ mediaId, isThumbnail })
                }}
              />
            </div>

            <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
              <h3 className="text-sm font-medium">Setup checklist</h3>
              <ul className="mt-3 space-y-2 text-sm">
                <ChecklistItem
                  done={checklist.details}
                  label="Product title and handle"
                />
                <ChecklistItem
                  done={checklist.media}
                  label="At least one product image"
                />
                <ChecklistItem
                  done={checklist.category}
                  label="Assigned to a category"
                />
                <ChecklistItem
                  done={checklist.variants}
                  label="Variants and pricing"
                />
              </ul>
            </div>
          </section>
        ) : null}

        {currentStep === 3 ? (
          <section className="flex flex-col gap-6">
            <div>
              <h2 className="text-lg font-medium">Variants</h2>
              <p className="text-sm text-muted-foreground">
                Set SKU, title, price, and optional compare-at price. Stock is
                set by each store after import.
              </p>
            </div>

            <div className="admin-panel">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs font-medium tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3.5 py-2.5">Title</th>
                    <th className="px-3.5 py-2.5">SKU</th>
                    <th className="px-3.5 py-2.5">Price (₹)</th>
                    <th className="px-3.5 py-2.5">Compare-at</th>
                    <th className="px-3.5 py-2.5">Status</th>
                    <th className="px-3.5 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {variants.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3.5 py-8 text-center text-muted-foreground"
                      >
                        No variants yet. Add one below.
                      </td>
                    </tr>
                  ) : (
                    variants.map((variant) => (
                      <tr
                        key={variant.id}
                        className="border-t border-border/70 transition-colors hover:bg-muted/40"
                      >
                        <td className="px-3.5 py-2.5">{variant.title}</td>
                        <td className="px-3.5 py-2.5 text-muted-foreground">
                          {variant.sku}
                        </td>
                        <td className="px-3.5 py-2.5 tabular-nums">
                          {formatPaise(variant.pricePaise)}
                        </td>
                        <td className="px-3.5 py-2.5 tabular-nums text-muted-foreground">
                          {variant.compareAtPricePaise != null
                            ? formatPaise(variant.compareAtPricePaise)
                            : "—"}
                        </td>
                        <td className="px-3.5 py-2.5 text-muted-foreground">
                          {variant.status}
                        </td>
                        <td className="px-3.5 py-2.5 text-right">
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

            <form
              onSubmit={onSubmitVariant}
              className="grid gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-3"
            >
              <Field>
                <FieldLabel htmlFor="variantTitle">Title</FieldLabel>
                <Input
                  id="variantTitle"
                  value={variantTitle}
                  onChange={(e) => setVariantTitle(e.target.value)}
                  disabled={isPending}
                  placeholder="S / M / L / XL"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="sku">SKU</FieldLabel>
                <Input
                  id="sku"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  disabled={isPending}
                  placeholder="jacket-s"
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
              <Field>
                <FieldLabel htmlFor="variantStatus">Status</FieldLabel>
                <select
                  id="variantStatus"
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  value={variantStatus}
                  onChange={(e) =>
                    setVariantStatus(e.target.value as GlobalProductStatus)
                  }
                  disabled={isPending}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Published</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </Field>
              <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
                <Button type="submit" disabled={isPending}>
                  {editingVariantId ? "Save variant" : "Add variant"}
                </Button>
                {editingVariantId ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isPending}
                    onClick={resetVariantForm}
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>
            </form>
          </section>
        ) : null}
      </div>

      <footer className="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-background px-4 py-3">
        <Button
          type="button"
          variant="ghost"
          disabled={isPending}
          onClick={closeWizard}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={onSaveDraft}
        >
          Save as draft
        </Button>
        {currentStep < CREATE_STEP_MAX ? (
          <Button type="button" disabled={isPending} onClick={onContinue}>
            {isPending ? "Saving..." : "Continue"}
          </Button>
        ) : (
          <Button type="button" disabled={isPending} onClick={onPublish}>
            {isPending ? "Publishing..." : "Publish"}
          </Button>
        )}
      </footer>
    </div>
  )
}

function ChecklistItem({
  done,
  label,
  hint,
}: {
  done: boolean
  label: string
  hint?: string
}) {
  return (
    <li className="flex items-start gap-2">
      <span
        className={
          done
            ? "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-foreground text-[10px] text-background"
            : "mt-0.5 size-4 shrink-0 rounded-full border border-muted-foreground/40"
        }
        aria-hidden
      >
        {done ? "✓" : null}
      </span>
      <span>
        <span className={done ? "text-foreground" : "text-muted-foreground"}>
          {label}
        </span>
        {hint && !done ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </span>
    </li>
  )
}

export default function CreateGlobalProductPage() {
  return (
    <PermissionGate permission="global_catalog.manage">
      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Loading...</p>}
      >
        <CreateGlobalProductPageContent />
      </Suspense>
    </PermissionGate>
  )
}
