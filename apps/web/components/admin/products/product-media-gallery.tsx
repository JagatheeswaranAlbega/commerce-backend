"use client"

import { useState } from "react"
import { ArrowLeft, ArrowRight, ImageIcon, Upload } from "lucide-react"

import { useAuthedMediaUrl } from "@/components/admin/products/product-table-thumbnail"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { AdminProductImage } from "@/lib/api/admin/products"
import { cn } from "@/lib/utils"

function MediaThumb({
  mediaId,
  alt,
  isThumbnail,
  canMoveLeft,
  canMoveRight,
  onRemove,
  onSetThumbnail,
  onMoveLeft,
  onMoveRight,
  removing,
  settingThumbnail,
  reordering,
  disabled,
}: {
  mediaId: string
  alt: string
  isThumbnail: boolean
  canMoveLeft: boolean
  canMoveRight: boolean
  onRemove: () => void
  onSetThumbnail: () => void
  onMoveLeft: () => void
  onMoveRight: () => void
  removing: boolean
  settingThumbnail: boolean
  reordering: boolean
  disabled?: boolean
}) {
  const url = useAuthedMediaUrl(mediaId)
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-muted/30",
        isThumbnail && "ring-2 ring-foreground/80"
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} className="h-28 w-28 object-cover" />
      ) : (
        <div className="flex h-28 w-28 items-center justify-center text-muted-foreground">
          <ImageIcon className="size-5" />
        </div>
      )}
      {isThumbnail ? (
        <span className="absolute left-1 top-1 rounded bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background">
          Thumbnail
        </span>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-black/55 p-1 opacity-0 transition-opacity group-hover:opacity-100">
        <div className="flex gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 flex-1 text-xs text-white hover:bg-white/10 hover:text-white"
            disabled={disabled || reordering || !canMoveLeft}
            onClick={onMoveLeft}
            aria-label="Move earlier"
          >
            <ArrowLeft className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 flex-1 text-xs text-white hover:bg-white/10 hover:text-white"
            disabled={disabled || reordering || !canMoveRight}
            onClick={onMoveRight}
            aria-label="Move later"
          >
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-full text-xs text-white hover:bg-white/10 hover:text-white"
          disabled={disabled || settingThumbnail || removing || reordering}
          onClick={onSetThumbnail}
        >
          {isThumbnail ? "Unset" : "Set thumbnail"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-full text-xs text-white hover:bg-white/10 hover:text-white"
          disabled={disabled || removing || settingThumbnail || reordering}
          onClick={onRemove}
        >
          Remove
        </Button>
      </div>
    </div>
  )
}

type ProductMediaGalleryProps = {
  images: AdminProductImage[]
  isUploading: boolean
  isRemoving: boolean
  isSettingThumbnail?: boolean
  isReordering?: boolean
  disabled?: boolean
  onUpload: (file: File, altText?: string) => void
  onRemove: (mediaId: string) => void
  onSetThumbnail: (mediaId: string, isThumbnail: boolean) => void
  onReorder?: (mediaId: string, swapWithMediaId: string) => void
}

export function ProductMediaGallery({
  images,
  isUploading,
  isRemoving,
  isSettingThumbnail = false,
  isReordering = false,
  disabled = false,
  onUpload,
  onRemove,
  onSetThumbnail,
  onReorder,
}: ProductMediaGalleryProps) {
  const [altText, setAltText] = useState("")

  const ordered = [...images].sort((a, b) => {
    if (a.isThumbnail !== b.isThumbnail) return a.isThumbnail ? -1 : 1
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  })

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const alt = altText.trim() || undefined
    Array.from(fileList).forEach((file) => onUpload(file, alt))
  }

  return (
    <div className="flex flex-col gap-4">
      {ordered.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-3">
            {ordered.map((image, index) => (
              <MediaThumb
                key={image.id}
                mediaId={image.id}
                alt={image.altText ?? "Product image"}
                isThumbnail={Boolean(image.isThumbnail)}
                canMoveLeft={Boolean(onReorder) && index > 0}
                canMoveRight={Boolean(onReorder) && index < ordered.length - 1}
                removing={isRemoving}
                settingThumbnail={isSettingThumbnail}
                reordering={isReordering}
                disabled={disabled}
                onRemove={() => onRemove(image.id)}
                onSetThumbnail={() =>
                  onSetThumbnail(image.id, !image.isThumbnail)
                }
                onMoveLeft={() => {
                  const prev = ordered[index - 1]
                  if (prev && onReorder) onReorder(image.id, prev.id)
                }}
                onMoveRight={() => {
                  const next = ordered[index + 1]
                  if (next && onReorder) onReorder(image.id, next.id)
                }}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            The first uploaded image becomes the thumbnail automatically. Use
            arrows to reorder the gallery.
          </p>
        </div>
      ) : null}

      <Field>
        <FieldLabel htmlFor="media-alt-text">Alt text (optional)</FieldLabel>
        <Input
          id="media-alt-text"
          value={altText}
          onChange={(e) => setAltText(e.target.value)}
          disabled={disabled || isUploading}
          placeholder="Describe the image for accessibility"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Applied to the next upload(s). Leave blank to skip.
        </p>
      </Field>

      <label
        className={
          disabled || isUploading
            ? "flex cursor-not-allowed flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 bg-muted/30 px-6 py-10 text-center opacity-60"
            : "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 bg-muted/20 px-6 py-10 text-center transition-colors hover:border-border hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
        }
        onDragOver={(e) => {
          e.preventDefault()
        }}
        onDrop={(e) => {
          e.preventDefault()
          if (disabled || isUploading) return
          handleFiles(e.dataTransfer.files)
        }}
      >
        <Upload className="size-5 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">
            {isUploading ? "Uploading..." : "Upload images"}
          </p>
          <p className="text-xs text-muted-foreground">
            Drag and drop images here or click to upload (multiple allowed)
          </p>
        </div>
        <input
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          disabled={disabled || isUploading}
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ""
          }}
        />
      </label>
    </div>
  )
}
