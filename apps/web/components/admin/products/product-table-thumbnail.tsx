"use client"

import { ImageIcon } from "lucide-react"
import { useEffect, useState } from "react"

import { getAccessToken } from "@/lib/auth-cookie"
import { cn } from "cn"

export function useAuthedMediaUrl(mediaId: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false

    async function load() {
      if (!mediaId) {
        setUrl(null)
        return
      }
      const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "")
      const token = getAccessToken()
      if (!base || !token) return
      const response = await fetch(`${base}/api/v1/admin/media/${mediaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok || cancelled) return
      const blob = await response.blob()
      objectUrl = URL.createObjectURL(blob)
      if (!cancelled) setUrl(objectUrl)
    }

    void load()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [mediaId])

  return url
}

type ProductTableThumbnailProps = {
  mediaId?: string | null
  title: string
  className?: string
}

export function ProductTableThumbnail({
  mediaId,
  title,
  className,
}: ProductTableThumbnailProps) {
  const url = useAuthedMediaUrl(mediaId)

  return (
    <span
      className={cn(
        "bg-muted relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border text-xs text-muted-foreground",
        className
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={title}
          className="size-full object-cover"
        />
      ) : mediaId ? (
        <ImageIcon className="size-3.5 opacity-50" aria-hidden />
      ) : (
        <span aria-hidden>{title.slice(0, 1).toUpperCase() || "?"}</span>
      )}
    </span>
  )
}
