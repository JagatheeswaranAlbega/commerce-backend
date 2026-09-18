"use client"

import { Check, X } from "lucide-react"
import { cn } from "cn"

import {
  CREATE_PRODUCT_STEPS,
  type CreateProductStepId,
} from "@/components/admin/products/product-steps"
import { Button } from "@/components/ui/button"

type CreateProductStepperProps = {
  currentStep: CreateProductStepId
  onClose: () => void
}

export function CreateProductStepper({
  currentStep,
  onClose,
}: CreateProductStepperProps) {
  return (
    <header className="flex items-center gap-4 border-b px-4 py-3">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Close"
        className="text-muted-foreground"
        onClick={onClose}
      >
        <X className="size-4" />
      </Button>

      <nav aria-label="Create product steps" className="flex-1">
        <ol className="flex items-center justify-center gap-6">
          {CREATE_PRODUCT_STEPS.map((step) => {
            const state =
              step.id < currentStep
                ? "completed"
                : step.id === currentStep
                  ? "active"
                  : "upcoming"

            return (
              <li key={step.id} className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full border text-[11px] font-medium",
                    state === "completed" &&
                      "border-foreground bg-foreground text-background",
                    state === "active" &&
                      "border-blue-600 text-blue-600 ring-2 ring-blue-600/15",
                    state === "upcoming" &&
                      "border-border text-muted-foreground"
                  )}
                >
                  {state === "completed" ? (
                    <Check className="size-3.5" aria-hidden />
                  ) : (
                    step.id
                  )}
                </span>
                <span
                  className={cn(
                    "text-sm font-medium",
                    state === "active" && "text-blue-600",
                    state === "upcoming" && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </li>
            )
          })}
        </ol>
      </nav>

      <div className="w-8" aria-hidden />
    </header>
  )
}
