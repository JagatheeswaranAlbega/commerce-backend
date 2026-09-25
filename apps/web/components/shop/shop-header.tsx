"use client"

import Link from "next/link"
import { MenuIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import type { StorefrontCategory } from "@/lib/api/storefront"

type ShopHeaderProps = {
  storeName: string
  categories: StorefrontCategory[]
}

export function ShopHeader({ storeName, categories }: ShopHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/95 backdrop-blur">
      <div className="bg-primary px-4 py-1.5 text-center text-[11px] tracking-[0.18em] text-primary-foreground uppercase">
        Complimentary shipping on orders over ₹5,000
      </div>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Sheet>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Open menu"
              />
            }
          >
            <MenuIcon />
          </SheetTrigger>
          <SheetContent side="left" className="w-72">
            <SheetHeader>
              <SheetTitle className="font-[family-name:var(--font-shop-serif)] text-2xl">
                {storeName}
              </SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 px-6 pb-6">
              <Link
                href="/shop"
                className="rounded-md px-2 py-2 text-sm hover:bg-muted"
              >
                Home
              </Link>
              <Link
                href="/shop/products"
                className="rounded-md px-2 py-2 text-sm hover:bg-muted"
              >
                Shop All
              </Link>
              <Link
                href="/shop/categories"
                className="rounded-md px-2 py-2 text-sm hover:bg-muted"
              >
                Categories
              </Link>
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/shop/categories/${category.slug}`}
                  className="rounded-md px-2 py-2 text-sm hover:bg-muted"
                >
                  {category.name}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        <Link
          href="/shop"
          className="font-[family-name:var(--font-shop-serif)] text-3xl tracking-tight text-primary"
        >
          {storeName}
        </Link>

        <nav className="hidden items-center gap-6 text-sm md:flex">
          <Link href="/shop/products" className="hover:text-primary">
            Shop All
          </Link>
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/shop/categories/${category.slug}`}
              className="hover:text-primary"
            >
              {category.name}
            </Link>
          ))}
        </nav>

        <div className="w-9 md:hidden" />
      </div>
    </header>
  )
}
