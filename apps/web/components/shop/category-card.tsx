import Link from "next/link"

import type { StorefrontCategory } from "@/lib/api/storefront"
import { categoryBlurb } from "@/lib/shop-copy"

export function CategoryCard({ category }: { category: StorefrontCategory }) {
  return (
    <Link
      href={`/shop/categories/${category.slug}`}
      className="group relative flex min-h-56 flex-col justify-end overflow-hidden bg-primary px-6 py-6 text-primary-foreground"
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-black/10 transition group-hover:from-black/55" />
      <div className="relative">
        <h3 className="font-[family-name:var(--font-shop-serif)] text-3xl">
          {category.name}
        </h3>
        <p className="mt-2 max-w-sm text-sm text-primary-foreground/85">
          {categoryBlurb(category.slug)}
        </p>
        <span className="mt-4 inline-block text-xs tracking-[0.16em] uppercase">
          Shop Now
        </span>
      </div>
    </Link>
  )
}
