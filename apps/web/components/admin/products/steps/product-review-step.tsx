"use client"

import { Badge } from "@/components/ui/badge"
import type { AdminCategory } from "@/lib/api/admin/categories"
import type {
  AdminProductImage,
  AdminVariant,
  ProductStatus,
} from "@/lib/api/admin/products"
import { formatPaise } from "@/lib/money"

type ProductReviewStepProps = {
  title: string
  handle: string
  shortDescription: string
  description: string
  status: ProductStatus
  categoryId: string
  categories: AdminCategory[]
  variants: AdminVariant[]
  images: AdminProductImage[]
}

export function ProductReviewStep({
  title,
  handle,
  shortDescription,
  description,
  status,
  categoryId,
  categories,
  variants,
  images,
}: ProductReviewStepProps) {
  const categoryName =
    categories.find((category) => category.id === categoryId)?.name ?? "None"

  return (
    <section className="flex max-w-2xl flex-col gap-6">
      <div>
        <h2 className="text-lg font-medium">Review & Publish</h2>
        <p className="text-sm text-muted-foreground">
          Confirm product details before publishing to the storefront.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Basic details</h3>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Title</dt>
              <dd>{title || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Handle</dt>
              <dd>{handle || "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Short description</dt>
              <dd>{shortDescription.trim() || "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Main description</dt>
              <dd>{description.trim() || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <Badge variant="secondary">{status}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Category</dt>
              <dd>{categoryName}</dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">
            Variants ({variants.length})
          </h3>
          {variants.length === 0 ? (
            <p className="text-sm text-muted-foreground">No variants added.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {variants.map((variant) => (
                <li
                  key={variant.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-b-0"
                >
                  <span>
                    {variant.title}{" "}
                    <span className="text-muted-foreground">
                      ({variant.sku})
                    </span>
                  </span>
                  <span className="font-medium">
                    {formatPaise(variant.pricePaise)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Media ({images.length})</h3>
          <p className="text-sm text-muted-foreground">
            {images.length === 0
              ? "No images uploaded."
              : `${images.length} image${images.length === 1 ? "" : "s"} ready.`}
          </p>
        </div>
      </div>
    </section>
  )
}
