import Link from "next/link"

import {
  storefrontMediaSrc,
  type StorefrontProduct,
} from "@/lib/api/storefront"
import { formatPaise } from "@/lib/money"

export function ProductCard({ product }: { product: StorefrontProduct }) {
  const price = product.minPricePaise
  const compareAt = product.compareAtPricePaise
  const imageSrc = product.thumbnail?.id
    ? storefrontMediaSrc(product.thumbnail.id)
    : null

  return (
    <Link href={`/shop/products/${product.handle}`} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden bg-muted">
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageSrc}
            alt={product.thumbnail?.altText ?? product.title}
            className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-secondary to-muted">
            <span className="font-[family-name:var(--font-shop-serif)] text-4xl text-primary/40">
              {product.title.slice(0, 1)}
            </span>
          </div>
        )}
      </div>
      <div className="mt-3 space-y-1">
        <h3 className="text-sm leading-snug group-hover:text-primary">
          {product.title}
        </h3>
        <div className="flex items-baseline gap-2 text-sm">
          {price != null ? (
            <span className="font-medium">{formatPaise(price)}</span>
          ) : null}
          {compareAt != null && price != null && compareAt > price ? (
            <span className="text-muted-foreground line-through">
              {formatPaise(compareAt)}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  )
}

export function ProductGrid({ products }: { products: StorefrontProduct[] }) {
  if (products.length === 0) {
    return (
      <p className="py-16 text-center text-muted-foreground">
        No products in this collection yet.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
