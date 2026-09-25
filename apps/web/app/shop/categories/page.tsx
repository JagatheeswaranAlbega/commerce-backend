import type { Metadata } from "next"

import { CategoryCard } from "@/components/shop/category-card"
import { ShopLoadError, ShopSetupMessage } from "@/components/shop/shop-setup"
import { getStorefrontPublishableKey } from "@/lib/api"
import { listStorefrontCategories } from "@/lib/api/storefront"
import { sortShopCategories } from "@/lib/shop-copy"

export const metadata: Metadata = {
  title: "Categories",
}

export default async function ShopCategoriesPage() {
  if (!getStorefrontPublishableKey()) {
    return <ShopSetupMessage />
  }

  try {
    const categories = sortShopCategories(await listStorefrontCategories())

    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <p className="text-xs tracking-[0.18em] text-primary uppercase">
          Our Collections
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-shop-serif)] text-4xl md:text-5xl">
          Shop by category
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Click a category to see only those products — sarees, lehengas,
          kurtas, and more.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {categories.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      </div>
    )
  } catch (error) {
    return (
      <ShopLoadError
        message={error instanceof Error ? error.message : undefined}
      />
    )
  }
}
