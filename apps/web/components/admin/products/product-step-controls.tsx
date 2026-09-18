"use client"

import { Button } from "@/components/ui/button"

type ProductStepControlsProps = {
  isFirstStep: boolean
  isLastStep: boolean
  isPending: boolean
  onBack: () => void
  onNext: () => void
  onFinish: () => void
  nextLabel?: string
  finishLabel?: string
}

export function ProductStepControls({
  isFirstStep,
  isLastStep,
  isPending,
  onBack,
  onNext,
  onFinish,
  nextLabel = "Save & Continue",
  finishLabel = "Publish",
}: ProductStepControlsProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
      <div>
        {!isFirstStep ? (
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={onBack}
          >
            Previous
          </Button>
        ) : null}
      </div>
      <div className="flex gap-2">
        {isLastStep ? (
          <Button type="button" disabled={isPending} onClick={onFinish}>
            {isPending ? "Publishing..." : finishLabel}
          </Button>
        ) : (
          <Button type="button" disabled={isPending} onClick={onNext}>
            {isPending ? "Saving..." : nextLabel}
          </Button>
        )}
      </div>
    </div>
  )
}
