import { apiFetch, apiFetchList, toQueryString, type PaginationMeta } from "@/lib/api"

export type DiscountType = "PERCENTAGE" | "FIXED_PAISE"
export type DiscountStatus = "ACTIVE" | "INACTIVE"

export type AdminDiscount = {
  id: string
  code: string
  type: DiscountType
  value: number
  status: DiscountStatus
  startsAt?: string | null
  endsAt?: string | null
  minOrderPaise?: number | null
  usageLimit?: number | null
  usageCount?: number
  createdAt: string
  updatedAt?: string
}

export type CreateDiscountInput = {
  code: string
  type: DiscountType
  value: number
  status?: DiscountStatus
  startsAt?: string | null
  endsAt?: string | null
  minOrderPaise?: number | null
  usageLimit?: number | null
}

export type UpdateDiscountInput = {
  code?: string
  type?: DiscountType
  value?: number
  status?: DiscountStatus
  startsAt?: string | null
  endsAt?: string | null
  minOrderPaise?: number | null
  usageLimit?: number | null
}

export function listAdminDiscounts(input?: {
  page?: number
  pageSize?: number
}): Promise<{ data: AdminDiscount[]; pagination?: PaginationMeta }> {
  return apiFetchList<AdminDiscount[]>(
    `/admin/discounts${toQueryString({
      page: input?.page,
      pageSize: input?.pageSize,
    })}`,
    { auth: "session" }
  )
}

export function createAdminDiscount(
  input: CreateDiscountInput
): Promise<AdminDiscount> {
  return apiFetch<AdminDiscount>("/admin/discounts", {
    method: "POST",
    auth: "session",
    body: JSON.stringify(input),
  })
}

export function updateAdminDiscount(
  discountId: string,
  input: UpdateDiscountInput
): Promise<AdminDiscount> {
  return apiFetch<AdminDiscount>(`/admin/discounts/${discountId}`, {
    method: "PATCH",
    auth: "session",
    body: JSON.stringify(input),
  })
}

export function deleteAdminDiscount(discountId: string): Promise<void> {
  return apiFetch<void>(`/admin/discounts/${discountId}`, {
    method: "DELETE",
    auth: "session",
  })
}
