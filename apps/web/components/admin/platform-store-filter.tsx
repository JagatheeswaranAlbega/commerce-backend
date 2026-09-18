"use client"

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { listPlatformStores } from "@/lib/api/platform/stores"
import { cn } from "@/lib/utils"

type PlatformStoreFilterProps = {
  value: string
  onChange: (storeId: string) => void
  allowAll?: boolean
  className?: string
}

export function usePlatformStoreFilter(initial = "") {
  const [storeId, setStoreId] = useState(initial)

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("storeId")
    if (id) setStoreId(id)
  }, [])

  function setStoreIdAndUrl(next: string) {
    setStoreId(next)
    const url = new URL(window.location.href)
    if (next) url.searchParams.set("storeId", next)
    else url.searchParams.delete("storeId")
    window.history.replaceState({}, "", url.toString())
  }

  return { storeId, setStoreId: setStoreIdAndUrl }
}

export function PlatformStoreFilter({
  value,
  onChange,
  allowAll = true,
  className,
}: PlatformStoreFilterProps) {
  const storesQuery = useQuery({
    queryKey: ["platform", "stores"],
    queryFn: () => listPlatformStores({ pageSize: 100 }),
  })

  const stores = storesQuery.data?.data ?? []
  const selectValue = value || (allowAll ? "all" : stores[0]?.id || "all")
  const items = [
    ...(allowAll ? [{ value: "all", label: "All stores" }] : []),
    ...stores.map((store) => ({ value: store.id, label: store.name })),
  ]

  return (
    <div className={cn("flex min-w-48 flex-col gap-1.5", className)}>
      <label
        className="text-sm font-medium text-muted-foreground"
        htmlFor="store-filter"
      >
        Store
      </label>
      <Select
        value={selectValue}
        items={items}
        onValueChange={(next) => {
          if (next == null) return
          onChange(next === "all" ? "" : String(next))
        }}
      >
        <SelectTrigger id="store-filter" className="min-w-56">
          <SelectValue placeholder="Select store" />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} align="start">
          {allowAll ? <SelectItem value="all">All stores</SelectItem> : null}
          {stores.map((store) => (
            <SelectItem key={store.id} value={store.id}>
              {store.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
