export const CREATE_PRODUCT_STEPS = [
  { id: 1, label: "Details" },
  { id: 2, label: "Organize" },
  { id: 3, label: "Variants" },
] as const

export type CreateProductStepId = (typeof CREATE_PRODUCT_STEPS)[number]["id"]

export const CREATE_STEP_MIN = 1
export const CREATE_STEP_MAX = CREATE_PRODUCT_STEPS.length

export function parseCreateProductStep(
  value: string | null
): CreateProductStepId {
  const parsed = Number(value ?? "1")
  if (
    Number.isInteger(parsed) &&
    parsed >= CREATE_STEP_MIN &&
    parsed <= CREATE_STEP_MAX
  ) {
    return parsed as CreateProductStepId
  }
  return 1
}

/** @deprecated Kept for any leftover imports; prefer CREATE_PRODUCT_STEPS. */
export const PRODUCT_STEPS = [
  { id: 1, label: "Basic Details", description: "Title, handle, and category" },
  { id: 2, label: "Variants & Pricing", description: "SKUs and prices" },
  { id: 3, label: "Media & Images", description: "Product gallery" },
  { id: 4, label: "Review & Publish", description: "Confirm and publish" },
] as const

export type ProductStepId = (typeof PRODUCT_STEPS)[number]["id"]

export const PRODUCT_STEP_MIN = 1
export const PRODUCT_STEP_MAX = PRODUCT_STEPS.length

export function parseProductStep(value: string | null): ProductStepId {
  const parsed = Number(value ?? "1")
  if (
    Number.isInteger(parsed) &&
    parsed >= PRODUCT_STEP_MIN &&
    parsed <= PRODUCT_STEP_MAX
  ) {
    return parsed as ProductStepId
  }
  return 1
}
