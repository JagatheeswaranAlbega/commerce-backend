import type { Metadata } from "next"
import Link from "next/link"

import { ProductGrid } from "@/components/shop/product-card"
import { ShopLoadError, ShopSetupMessage } from "@/components/shop/shop-setup"
import { getStorefrontPublishableKey } from "@/lib/api"
import { listStorefrontProducts } from "@/lib/api/storefront"

export const metadata: Metadata = {
  title: "Shop All",
}

export default async function ShopProductsPage() {
  if (!getStorefrontPublishableKey()) {
    return <ShopSetupMessage />
  }

  try {
    const catalog = await listStorefrontProducts({
      page: 1,
      pageSize: 40,
      sort: "created_at_desc",
    })

    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <nav className="text-xs text-muted-foreground">
          <Link href="/shop" className="hover:text-primary">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">The Collection</span>
        </nav>
        <h1 className="mt-4 font-[family-name:var(--font-shop-serif)] text-4xl md:text-5xl">
          Shop All
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Explore our curated pieces
        </p>
        <div className="mt-10">
          <ProductGrid products={catalog.data} />
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
