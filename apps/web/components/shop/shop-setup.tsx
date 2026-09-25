export function ShopSetupMessage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="font-[family-name:var(--font-shop-serif)] text-3xl text-primary">
        Storefront is almost ready
      </h1>
      <p className="mt-4 text-sm text-muted-foreground">
        Add the store publishable key as{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
          NEXT_PUBLIC_STOREFRONT_PUBLISHABLE_KEY
        </code>{" "}
        in <code className="rounded bg-muted px-1.5 py-0.5 text-xs">apps/web/.env</code>{" "}
        (from seed output or Admin → Keys), then restart the web app.
      </p>
    </div>
  )
}

export function ShopLoadError({ message }: { message?: string }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="font-[family-name:var(--font-shop-serif)] text-3xl text-primary">
        Catalog unavailable
      </h1>
      <p className="mt-4 text-sm text-muted-foreground">
        {message ?? "The storefront could not load this store. Confirm the API is running and the publishable key matches an active store."}
      </p>
    </div>
  )
}
