"use client"

import { useEffect, useState } from "react"
import { ImageIcon, Star, Trash2, Upload } from "lucide-react"

import { useAuthedMediaUrl } from "@/components/admin/products/product-table-thumbnail"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type ProductMediaItem = {
  id: string
  altText: string | null
  isThumbnail?: boolean
  sortOrder?: number | null
}

const DEFAULT_MEDIA_PATH_PREFIX = "/api/v1/admin/media"

function MediaThumb({
  mediaId,
  alt,
  isThumbnail,
  selected,
  onSelect,
  compact,
  mediaPathPrefix,
}: {
  mediaId: string
  alt: string
  isThumbnail: boolean
  selected: boolean
  onSelect: () => void
  compact?: boolean
  mediaPathPrefix: string
}) {
  const url = useAuthedMediaUrl(mediaId, mediaPathPrefix)

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`View ${alt}`}
      aria-pressed={selected}
      className={cn(
        "relative block shrink-0 overflow-hidden rounded-md border bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        isThumbnail && "ring-2 ring-foreground/80",
        selected && "ring-2 ring-primary"
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt}
          className={cn("object-cover", compact ? "size-12" : "h-20 w-20")}
        />
      ) : (
        <div
          className={cn(
            "flex items-center justify-center text-muted-foreground",
            compact ? "size-12" : "h-20 w-20"
          )}
        >
          <ImageIcon className="size-4" />
        </div>
      )}
      {isThumbnail ? (
        <span
          className={cn(
            "absolute left-0.5 top-0.5 rounded bg-foreground font-medium text-background",
            compact
              ? "p-0.5"
              : "px-1.5 py-0.5 text-[10px]"
          )}
        >
          {compact ? (
            <Star className="size-2.5 fill-current" aria-hidden />
          ) : (
            "Thumbnail"
          )}
          {compact ? <span className="sr-only">Thumbnail</span> : null}
        </span>
      ) : null}
    </button>
  )
}

function MediaPreview({
  mediaId,
  alt,
  isThumbnail,
  onRemove,
  onSetThumbnail,
  removing,
  settingThumbnail,
  disabled,
  compact,
  readOnly,
  mediaPathPrefix,
}: {
  mediaId: string
  alt: string
  isThumbnail: boolean
  onRemove: () => void
  onSetThumbnail: () => void
  removing: boolean
  settingThumbnail: boolean
  disabled?: boolean
  compact?: boolean
  readOnly?: boolean
  mediaPathPrefix: string
}) {
  const url = useAuthedMediaUrl(mediaId, mediaPathPrefix)
  const busy = disabled || removing || settingThumbnail

  return (
    <div className="relative overflow-hidden rounded-lg border bg-muted/20">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt}
          className={cn(
            "mx-auto w-full object-contain",
            compact ? "max-h-[280px]" : "max-h-[320px]"
          )}
        />
      ) : (
        <div
          className={cn(
            "flex items-center justify-center text-muted-foreground",
            compact ? "h-40" : "h-52"
          )}
        >
          <ImageIcon className="size-7 opacity-50" />
        </div>
      )}
      {readOnly ? null : (
        <div className="flex flex-wrap items-center gap-1.5 border-t bg-background/90 px-2 py-1.5">
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={busy}
            onClick={onSetThumbnail}
          >
            <Star className="size-3" />
            {isThumbnail ? "Unset thumbnail" : "Set as thumbnail"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="text-destructive hover:text-destructive"
            disabled={busy}
            onClick={onRemove}
          >
            <Trash2 className="size-3" />
            Remove
          </Button>
        </div>
      )}
    </div>
  )
}

type ProductMediaGalleryProps = {
  images: ProductMediaItem[]
  isUploading: boolean
  isRemoving: boolean
  isSettingThumbnail?: boolean
  disabled?: boolean
  compact?: boolean
  readOnly?: boolean
  mediaPathPrefix?: string
  onUpload: (file: File, altText?: string) => void
  onRemove: (mediaId: string) => void
  onSetThumbnail: (mediaId: string, isThumbnail: boolean) => void
}

export function ProductMediaGallery({
  images,
  isUploading,
  isRemoving,
  isSettingThumbnail = false,
  disabled = false,
  compact = false,
  readOnly = false,
  mediaPathPrefix = DEFAULT_MEDIA_PATH_PREFIX,
  onUpload,
  onRemove,
  onSetThumbnail,
}: ProductMediaGalleryProps) {
  const [altText, setAltText] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const ordered = [...images].sort((a, b) => {
    if (a.isThumbnail !== b.isThumbnail) return a.isThumbnail ? -1 : 1
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  })

  useEffect(() => {
    if (images.length === 0) {
      setSelectedId(null)
      return
    }
    setSelectedId((current) => {
      if (current && images.some((image) => image.id === current)) return current
      const sorted = [...images].sort((a, b) => {
        if (a.isThumbnail !== b.isThumbnail) return a.isThumbnail ? -1 : 1
        return (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
      })
      return sorted[0]?.id ?? null
    })
  }, [images])

  const selected = ordered.find((image) => image.id === selectedId) ?? ordered[0]

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const alt = altText.trim() || undefined
    Array.from(fileList).forEach((file) => onUpload(file, alt))
  }

  const dropDisabled = disabled || isUploading

  return (
    <div className={cn("flex flex-col", compact ? "gap-2.5" : "gap-3")}>
      {selected ? (
        <MediaPreview
          mediaId={selected.id}
          alt={selected.altText ?? "Product image"}
          isThumbnail={Boolean(selected.isThumbnail)}
          removing={isRemoving}
          settingThumbnail={isSettingThumbnail}
          disabled={disabled}
          compact={compact}
          readOnly={readOnly}
          mediaPathPrefix={mediaPathPrefix}
          onRemove={() => onRemove(selected.id)}
          onSetThumbnail={() =>
            onSetThumbnail(selected.id, !selected.isThumbnail)
          }
        />
      ) : null}

      {ordered.length > 0 ? (
        <div className="-mx-0.5 flex gap-1.5 overflow-x-auto px-0.5 py-0.5">
          {ordered.map((image) => (
            <MediaThumb
              key={image.id}
              mediaId={image.id}
              alt={image.altText ?? "Product image"}
              isThumbnail={Boolean(image.isThumbnail)}
              selected={image.id === selected?.id}
              compact={compact}
              mediaPathPrefix={mediaPathPrefix}
              onSelect={() => setSelectedId(image.id)}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {readOnly
            ? "No images for this product."
            : "No images yet. Upload product photos to show them here."}
        </p>
      )}

      {readOnly ? null : (
      <>
      <label
        className={cn(
          "flex items-center justify-center gap-2 rounded-lg border border-dashed border-border/80 bg-muted/20 text-center transition-colors",
          ordered.length === 0 ? "flex-col px-4 py-6" : "px-3 py-2.5",
          dropDisabled
            ? "cursor-not-allowed opacity-60"
            : "cursor-pointer hover:border-border hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
        )}
        onDragOver={(e) => {
          e.preventDefault()
        }}
        onDrop={(e) => {
          e.preventDefault()
          if (dropDisabled) return
          handleFiles(e.dataTransfer.files)
        }}
      >
        <Upload className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-sm font-medium leading-tight">
            {isUploading ? "Uploading..." : "Upload images"}
          </p>
          <p className="text-xs text-muted-foreground">
            Drag and drop or click to upload
          </p>
        </div>
        <input
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          disabled={dropDisabled}
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ""
          }}
        />
      </label>

      <Input
        id="media-alt-text"
        value={altText}
        onChange={(e) => setAltText(e.target.value)}
        disabled={dropDisabled}
        placeholder="Alt text for next upload (optional)"
        aria-label="Alt text for next upload"
      />
      </>
      )}
    </div>
  )
}
