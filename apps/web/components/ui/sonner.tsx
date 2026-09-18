"use client"

import type { CSSProperties } from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react"

const TOAST_DURATION_MS = 5000

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      closeButton
      duration={TOAST_DURATION_MS}
      visibleToasts={4}
      gap={12}
      expand
      offset={16}
      icons={{
        success: <CircleCheckIcon className="size-4" strokeWidth={2.25} />,
        info: <InfoIcon className="size-4" strokeWidth={2.25} />,
        warning: <TriangleAlertIcon className="size-4" strokeWidth={2.25} />,
        error: <OctagonXIcon className="size-4" strokeWidth={2.25} />,
        loading: (
          <Loader2Icon className="size-4 animate-spin" strokeWidth={2.25} />
        ),
      }}
      style={
        {
          "--toast-duration": `${TOAST_DURATION_MS}ms`,
        } as CSSProperties
      }
      toastOptions={{
        duration: TOAST_DURATION_MS,
        classNames: {
          toast: "cn-toast group toast",
          title: "cn-toast-title",
          description: "cn-toast-description",
          actionButton: "cn-toast-action",
          cancelButton: "cn-toast-cancel",
          closeButton: "cn-toast-close",
          success: "toast-success",
          error: "toast-error",
          warning: "toast-warning",
          info: "toast-info",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, TOAST_DURATION_MS }
