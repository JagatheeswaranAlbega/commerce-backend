import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { ProductGrid } from "@/components/shop/product-card"
import { ShopLoadError, ShopSetupMessage } from "@/components/shop/shop-setup"
import { ApiError, getStorefrontPublishableKey } from "@/lib/api"
import { getStorefrontCategory } from "@/lib/api/storefront"
import { categoryBlurb } from "@/lib/shop-copy"

type CategoryPageProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params
  if (!getStorefrontPublishableKey()) {
    return { title: "Category" }
  }
  try {
    const category = await getStorefrontCategory(slug)
    return { title: category.name }
  } catch {
    return { title: "Category" }
  }
}

export default async function ShopCategoryPage({ params }: CategoryPageProps) {
  if (!getStorefrontPublishableKey()) {
    return <ShopSetupMessage />
  }

  const { slug } = await params

  try {
    const category = await getStorefrontCategory(slug)

    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <nav className="text-xs text-muted-foreground">
          <Link href="/shop" className="hover:text-primary">
            Home
          </Link>
          <span className="mx-2">/</span>
          <Link href="/shop/categories" className="hover:text-primary">
            Categories
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{category.name}</span>
        </nav>
        <h1 className="mt-4 font-[family-name:var(--font-shop-serif)] text-4xl md:text-5xl">
          {category.name}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          {categoryBlurb(category.slug)}
        </p>
        <div className="mt-10">
          <ProductGrid products={category.products} />
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
