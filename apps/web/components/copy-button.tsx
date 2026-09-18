"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import type { VariantProps } from "class-variance-authority"

import { Button, buttonVariants } from "@/components/ui/button"

type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>

export function CopyButton({
  value,
  label = "Copy",
  size = "icon",
}: {
  value: string
  label?: string
  size?: ButtonSize
}) {
  const [copied, setCopied] = useState(false)

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      onClick={() => void onCopy()}
      aria-label={copied ? "Copied" : label}
    >
      {copied ? <Check /> : <Copy />}
    </Button>
  )
}
