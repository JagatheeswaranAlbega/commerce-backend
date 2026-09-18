"use client"

import {
  CircleAlertIcon,
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  Trash2Icon,
} from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"

export type ConfirmDialogVariant =
  | "default"
  | "destructive"
  | "success"
  | "warning"
  | "info"

type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  /** @deprecated Prefer `variant="destructive"` */
  destructive?: boolean
  variant?: ConfirmDialogVariant
  pending?: boolean
  onConfirm: () => void
}

const VARIANT_STYLES: Record<
  ConfirmDialogVariant,
  { media: string; icon: typeof Trash2Icon }
> = {
  default: {
    media: "bg-muted text-muted-foreground",
    icon: CircleAlertIcon,
  },
  destructive: {
    media: "bg-[color-mix(in_oklch,var(--destructive)_12%,transparent)] text-destructive",
    icon: Trash2Icon,
  },
  success: {
    media: "bg-[color-mix(in_oklch,oklch(0.62_0.17_145)_14%,transparent)] text-[oklch(0.62_0.17_145)]",
    icon: CircleCheckIcon,
  },
  warning: {
    media: "bg-[color-mix(in_oklch,oklch(0.7_0.15_70)_14%,transparent)] text-[oklch(0.7_0.15_70)]",
    icon: TriangleAlertIcon,
  },
  info: {
    media: "bg-[color-mix(in_oklch,oklch(0.6_0.14_250)_14%,transparent)] text-[oklch(0.6_0.14_250)]",
    icon: InfoIcon,
  },
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  variant,
  pending = false,
  onConfirm,
}: ConfirmDialogProps) {
  const resolvedVariant: ConfirmDialogVariant =
    variant ?? (destructive ? "destructive" : "default")
  const style = VARIANT_STYLES[resolvedVariant]
  const Icon = style.icon

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="default">
        <AlertDialogHeader>
          <AlertDialogMedia className={cn("!size-12 rounded-2xl", style.media)}>
            <Icon className="size-5" aria-hidden />
          </AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant={
              resolvedVariant === "destructive" ? "destructive" : "default"
            }
            disabled={pending}
            onClick={(event) => {
              event.preventDefault()
              onConfirm()
            }}
          >
            {pending ? "Please wait…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
