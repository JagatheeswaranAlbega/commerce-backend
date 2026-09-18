"use client"

import { Check } from "lucide-react"
import { cn } from "cn"

import {
  PRODUCT_STEPS,
  type ProductStepId,
} from "@/components/admin/products/product-steps"

type ProductStepperProps = {
  currentStep: ProductStepId
  onStepSelect?: (step: ProductStepId) => void
  disabled?: boolean
}

export function ProductStepper({
  currentStep,
  onStepSelect,
  disabled = false,
}: ProductStepperProps) {
  return (
    <nav aria-label="Product setup steps" className="w-full">
      <ol className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-0">
        {PRODUCT_STEPS.map((step, index) => {
          const state =
            step.id < currentStep
              ? "completed"
              : step.id === currentStep
                ? "active"
                : "upcoming"
          const isLast = index === PRODUCT_STEPS.length - 1
          const clickable = Boolean(onStepSelect) && !disabled

          return (
            <li
              key={step.id}
              className={cn(
                "relative flex flex-1 items-start gap-3",
                !isLast && "sm:pr-4"
              )}
            >
              {!isLast ? (
                <div
                  aria-hidden
                  className={cn(
                    "absolute top-4 left-4 hidden h-px w-[calc(100%-1rem)] sm:block",
                    state === "completed" ? "bg-primary" : "bg-border"
                  )}
                />
              ) : null}
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onStepSelect?.(step.id)}
                className={cn(
                  "relative z-10 flex items-start gap-3 text-left",
                  clickable && "cursor-pointer",
                  !clickable && "cursor-default"
                )}
                aria-current={state === "active" ? "step" : undefined}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                    state === "completed" &&
                      "border-primary bg-primary text-primary-foreground",
                    state === "active" &&
                      "border-primary bg-background text-primary ring-2 ring-primary/20",
                    state === "upcoming" &&
                      "border-border bg-muted text-muted-foreground"
                  )}
                >
                  {state === "completed" ? (
                    <Check className="size-4" aria-hidden />
                  ) : (
                    step.id
                  )}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5 pt-0.5">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      state === "upcoming" && "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {state === "completed"
                      ? "Completed"
                      : state === "active"
                        ? "Active"
                        : "Upcoming"}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
