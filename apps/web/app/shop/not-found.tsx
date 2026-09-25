import Link from "next/link"

export default function ShopNotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="font-[family-name:var(--font-shop-serif)] text-4xl text-primary">
        Not found
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        This page is not in the collection.
      </p>
      <Link
        href="/shop"
        className="mt-6 inline-flex h-10 items-center bg-primary px-5 text-sm text-primary-foreground"
      >
        Back to shop
      </Link>
    </div>
  )
}
