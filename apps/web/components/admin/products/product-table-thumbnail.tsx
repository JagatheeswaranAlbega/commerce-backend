"use client"

import { ImageIcon } from "lucide-react"
import { useEffect, useState } from "react"

import { getAccessToken } from "@/lib/auth-cookie"
import { cn } from "cn"

function sniffBlobType(bytes: ArrayBuffer): string | null {
  const u8 = new Uint8Array(bytes)
  if (u8.length >= 3 && u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff) {
    return "image/jpeg"
  }
  if (
    u8.length >= 8 &&
    u8[0] === 0x89 &&
    u8[1] === 0x50 &&
    u8[2] === 0x4e &&
    u8[3] === 0x47
  ) {
    return "image/png"
  }
  if (u8.length >= 6 && u8[0] === 0x47 && u8[1] === 0x49 && u8[2] === 0x46) {
    return "image/gif"
  }
  if (
    u8.length >= 12 &&
    u8[0] === 0x52 &&
    u8[1] === 0x49 &&
    u8[2] === 0x46 &&
    u8[3] === 0x46 &&
    u8[8] === 0x57 &&
    u8[9] === 0x45 &&
    u8[10] === 0x42 &&
    u8[11] === 0x50
  ) {
    return "image/webp"
  }
  return null
}

export function useAuthedMediaUrl(
  mediaId: string | null | undefined,
  pathPrefix = "/api/v1/admin/media"
) {
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
      const response = await fetch(`${base}${pathPrefix}/${mediaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok || cancelled) return
      const buffer = await response.arrayBuffer()
      if (cancelled) return
      const sniffed = sniffBlobType(buffer)
      const type =
        sniffed ??
        (response.headers.get("Content-Type")?.split(";")[0]?.trim() ||
          "application/octet-stream")
      const blob = new Blob([buffer], { type })
      objectUrl = URL.createObjectURL(blob)
      if (!cancelled) setUrl(objectUrl)
    }

    void load()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [mediaId, pathPrefix])

  return url
}

type ProductTableThumbnailProps = {
  mediaId?: string | null
  title: string
  className?: string
  mediaPathPrefix?: string
}

export function ProductTableThumbnail({
  mediaId,
  title,
  className,
  mediaPathPrefix = "/api/v1/admin/media",
}: ProductTableThumbnailProps) {
  const url = useAuthedMediaUrl(mediaId, mediaPathPrefix)

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
