import Link from "next/link"

import { CategoryCard } from "@/components/shop/category-card"
import { ProductGrid } from "@/components/shop/product-card"
import { ShopLoadError, ShopSetupMessage } from "@/components/shop/shop-setup"
import { getStorefrontPublishableKey } from "@/lib/api"
import {
  listStorefrontCategories,
  listStorefrontProducts,
} from "@/lib/api/storefront"
import { sortShopCategories } from "@/lib/shop-copy"

export default async function ShopHomePage() {
  if (!getStorefrontPublishableKey()) {
    return <ShopSetupMessage />
  }

  try {
    const [categories, catalog] = await Promise.all([
      listStorefrontCategories(),
      listStorefrontProducts({ page: 1, pageSize: 8, sort: "created_at_desc" }),
    ])
    const ordered = sortShopCategories(categories)

    return (
      <div>
        <section className="bg-muted/70 px-4 py-20 text-center">
          <p className="text-xs tracking-[0.22em] text-primary uppercase">
            The Heritage Collection
          </p>
          <h1 className="mx-auto mt-3 max-w-3xl font-[family-name:var(--font-shop-serif)] text-4xl leading-tight md:text-6xl">
            Discover timeless elegance for your most cherished moments
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground md:text-base">
            Immerse yourself in rich textures and intricate handwork. Shop by
            sarees, lehengas, kurtas, and more.
          </p>
          <Link
            href="/shop/categories"
            className="mt-8 inline-flex h-11 items-center bg-primary px-6 text-sm tracking-[0.12em] text-primary-foreground uppercase"
          >
            Explore the Boutique
          </Link>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-[family-name:var(--font-shop-serif)] text-3xl md:text-4xl">
                Curated Categories
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Find the perfect silhouette for every occasion
              </p>
            </div>
            <Link href="/shop/categories" className="text-sm hover:text-primary">
              View All Categories
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {ordered.map((category) => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-[family-name:var(--font-shop-serif)] text-3xl md:text-4xl">
                Just Arrived
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                The latest additions to our boutique
              </p>
            </div>
            <Link href="/shop/products" className="text-sm hover:text-primary">
              Shop All
            </Link>
          </div>
          <ProductGrid products={catalog.data} />
        </section>
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
