import Link from "next/link"

export function ShopFooter({ storeName }: { storeName: string }) {
  return (
    <footer className="mt-16 border-t border-border bg-secondary/50">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-3">
        <div>
          <p className="font-[family-name:var(--font-shop-serif)] text-2xl text-primary">
            {storeName}
          </p>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            Celebrating the timeless elegance of Indian ethnic wear. Handcrafted
            by master artisans, curated for your most treasured moments.
          </p>
        </div>
        <div>
          <h2 className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
            Quick Links
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/shop/products" className="hover:text-primary">
                Shop All
              </Link>
            </li>
            <li>
              <Link href="/shop/categories" className="hover:text-primary">
                Categories
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
            The Collection
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            🇮🇳 Made in India
          </p>
        </div>
      </div>
      <p className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {storeName}. All rights reserved.
      </p>
    </footer>
  )
}
