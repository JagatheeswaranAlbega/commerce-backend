"use client"

import { ProductMediaGallery } from "@/components/admin/products/product-media-gallery"
import type { AdminProductImage } from "@/lib/api/admin/products"

type ProductMediaStepProps = {
  images: AdminProductImage[]
  isUploading: boolean
  isRemoving: boolean
  isSettingThumbnail?: boolean
  disabled?: boolean
  onUpload: (file: File) => void
  onRemove: (mediaId: string) => void
  onSetThumbnail: (mediaId: string, isThumbnail: boolean) => void
}

export function ProductMediaStep({
  images,
  isUploading,
  isRemoving,
  isSettingThumbnail = false,
  disabled = false,
  onUpload,
  onRemove,
  onSetThumbnail,
}: ProductMediaStepProps) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium">Media & Images</h2>
        <p className="text-sm text-muted-foreground">
          Upload and manage product images. Changes save immediately.
        </p>
      </div>
      <ProductMediaGallery
        images={images}
        isUploading={isUploading}
        isRemoving={isRemoving}
        isSettingThumbnail={isSettingThumbnail}
        disabled={disabled}
        onUpload={onUpload}
        onRemove={onRemove}
        onSetThumbnail={onSetThumbnail}
      />
    </section>
  )
}
