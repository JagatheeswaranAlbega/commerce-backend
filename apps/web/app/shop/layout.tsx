import { Cormorant_Garamond } from "next/font/google"
import type { Metadata } from "next"

import { ShopFooter } from "@/components/shop/shop-footer"
import { ShopHeader } from "@/components/shop/shop-header"
import { getStorefrontPublishableKey } from "@/lib/api"
import {
  getStorefrontStore,
  listStorefrontCategories,
} from "@/lib/api/storefront"
import { sortShopCategories } from "@/lib/shop-copy"

const shopSerif = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-shop-serif",
  weight: ["400", "500", "600"],
})

export const metadata: Metadata = {
  title: "Shop",
  description: "Browse curated ethnic wear by category.",
}

export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let storeName = "Boutique"
  let categories = [] as Awaited<ReturnType<typeof listStorefrontCategories>>

  if (getStorefrontPublishableKey()) {
    try {
      const [store, items] = await Promise.all([
        getStorefrontStore(),
        listStorefrontCategories(),
      ])
      storeName = store.name
      categories = sortShopCategories(items)
    } catch {
      // Header still renders; pages show their own error states.
    }
  }

  return (
    <div className={`${shopSerif.variable} shop-theme min-h-screen`}>
      <ShopHeader storeName={storeName} categories={categories} />
      <main className="min-h-[60vh]">{children}</main>
      <ShopFooter storeName={storeName} />
    </div>
  )
}
