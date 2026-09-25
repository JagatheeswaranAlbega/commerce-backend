import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { ShopLoadError, ShopSetupMessage } from "@/components/shop/shop-setup"
import { ApiError, getStorefrontPublishableKey } from "@/lib/api"
import {
  getStorefrontProduct,
  storefrontMediaSrc,
} from "@/lib/api/storefront"
import { formatPaise } from "@/lib/money"

type ProductPageProps = {
  params: Promise<{ handle: string }>
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { handle } = await params
  if (!getStorefrontPublishableKey()) {
    return { title: "Product" }
  }
  try {
    const product = await getStorefrontProduct(handle)
    return { title: product.title }
  } catch {
    return { title: "Product" }
  }
}

export default async function ShopProductPage({ params }: ProductPageProps) {
  if (!getStorefrontPublishableKey()) {
    return <ShopSetupMessage />
  }

  const { handle } = await params

  try {
    const product = await getStorefrontProduct(handle)
    const image = product.images[0] ?? product.thumbnail
    const imageSrc = image?.id ? storefrontMediaSrc(image.id) : null
    const price =
      product.variants[0]?.pricePaise ?? product.minPricePaise ?? null
    const compareAt =
      product.variants[0]?.compareAtPricePaise ?? product.compareAtPricePaise

    return (
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-2">
        <div className="aspect-[3/4] overflow-hidden bg-muted">
          {imageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageSrc}
              alt={image?.altText ?? product.title}
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-gradient-to-br from-secondary to-muted">
              <span className="font-[family-name:var(--font-shop-serif)] text-6xl text-primary/40">
                {product.title.slice(0, 1)}
              </span>
            </div>
          )}
        </div>
        <div>
          <nav className="text-xs text-muted-foreground">
            <Link href="/shop" className="hover:text-primary">
              Home
            </Link>
            <span className="mx-2">/</span>
            <Link href="/shop/products" className="hover:text-primary">
              Shop All
            </Link>
          </nav>
          <h1 className="mt-4 font-[family-name:var(--font-shop-serif)] text-4xl">
            {product.title}
          </h1>
          <div className="mt-4 flex items-baseline gap-3">
            {price != null ? (
              <span className="text-xl font-medium">{formatPaise(price)}</span>
            ) : null}
            {compareAt != null && price != null && compareAt > price ? (
              <span className="text-muted-foreground line-through">
                {formatPaise(compareAt)}
              </span>
            ) : null}
          </div>
          {product.shortDescription ? (
            <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
              {product.shortDescription}
            </p>
          ) : null}
          {product.description ? (
            <p className="mt-4 text-sm leading-relaxed">{product.description}</p>
          ) : null}
        </div>
      </div>
    )
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound()
    }
    return (
      <ShopLoadError
        message={error instanceof Error ? error.message : undefined}
      />
    )
  }
}
