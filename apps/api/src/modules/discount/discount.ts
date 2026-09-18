import { and, eq, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { discounts } from "@/db/schema/discounts";
import { computeCheckoutTotals } from "@/modules/checkout";
import { InvalidStateError, NotFoundError, ValidationError } from "@/shared/errors/app-error";

export type DiscountType = "PERCENTAGE" | "FIXED_PAISE";

export type DiscountRuleFields = {
  status: string;
  startsAt: Date | null;
  endsAt: Date | null;
  minOrderPaise: number | null;
  usageLimit: number | null;
  usageCount: number;
};

export function normalizeDiscountCode(code: string): string {
  return code.trim().toUpperCase();
}

export function computeDiscountPaise(
  type: DiscountType,
  value: number,
  subtotalPaise: number,
): number {
  if (subtotalPaise <= 0 || value <= 0) return 0;
  if (type === "PERCENTAGE") {
    const pct = Math.min(value, 100);
    return Math.min(subtotalPaise, Math.floor((subtotalPaise * pct) / 100));
  }
  return Math.min(subtotalPaise, value);
}

/**
 * Enforce schedule, minimum order, and usage limit.
 * Window: startsAt inclusive, endsAt exclusive.
 */
export function assertDiscountApplicable(
  discount: DiscountRuleFields,
  subtotalPaise: number,
  now: Date = new Date(),
): void {
  if (discount.status !== "ACTIVE") {
    throw new InvalidStateError("Discount is not active.");
  }
  if (discount.startsAt && now < discount.startsAt) {
    throw new InvalidStateError("Discount not yet active.");
  }
  if (discount.endsAt && now >= discount.endsAt) {
    throw new InvalidStateError("Discount expired.");
  }
  if (
    discount.minOrderPaise != null &&
    discount.minOrderPaise > 0 &&
    subtotalPaise < discount.minOrderPaise
  ) {
    throw new InvalidStateError("Minimum order not met.");
  }
  if (
    discount.usageLimit != null &&
    discount.usageLimit >= 0 &&
    discount.usageCount >= discount.usageLimit
  ) {
    throw new InvalidStateError("Discount usage limit reached.");
  }
}

export async function findActiveDiscountByCode(db: Database, storeId: string, code: string) {
  const normalized = normalizeDiscountCode(code);
  if (!normalized) throw new ValidationError("Discount code is required.");

  const discount = await db.query.discounts.findFirst({
    where: and(
      eq(discounts.storeId, storeId),
      eq(discounts.code, normalized),
      eq(discounts.status, "ACTIVE"),
    ),
  });

  if (!discount) throw new NotFoundError("Discount not found.");
  return discount;
}

/**
 * Load ACTIVE discount by code and assert it applies to the given subtotal.
 */
export async function findApplicableDiscountByCode(
  db: Database,
  storeId: string,
  code: string,
  subtotalPaise: number,
  now: Date = new Date(),
) {
  const discount = await findActiveDiscountByCode(db, storeId, code);
  assertDiscountApplicable(discount, subtotalPaise, now);
  return discount;
}

/**
 * Atomically increment usage_count if still under usage_limit.
 * Returns false if the limit would be exceeded.
 */
export async function tryIncrementDiscountUsage(
  db: Database,
  storeId: string,
  discountId: string,
): Promise<boolean> {
  const updated = await db
    .update(discounts)
    .set({
      usageCount: sql`${discounts.usageCount} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(discounts.id, discountId),
        eq(discounts.storeId, storeId),
        sql`(${discounts.usageLimit} is null or ${discounts.usageCount} < ${discounts.usageLimit})`,
      ),
    )
    .returning({ id: discounts.id });

  return updated.length > 0;
}

/** Grand total including GST (3%) and flat ₹200 shipping. */
export function cartGrandTotalPaise(subtotalPaise: number, discountTotalPaise: number): number {
  return computeCheckoutTotals(subtotalPaise, discountTotalPaise).grandTotalPaise;
}
