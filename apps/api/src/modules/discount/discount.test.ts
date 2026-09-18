import { describe, expect, it } from "vitest";
import {
  assertDiscountApplicable,
  cartGrandTotalPaise,
  computeDiscountPaise,
  normalizeDiscountCode,
  type DiscountRuleFields,
} from "./discount";
import { InvalidStateError } from "@/shared/errors/app-error";

function baseDiscount(overrides: Partial<DiscountRuleFields> = {}): DiscountRuleFields {
  return {
    status: "ACTIVE",
    startsAt: null,
    endsAt: null,
    minOrderPaise: null,
    usageLimit: null,
    usageCount: 0,
    ...overrides,
  };
}

describe("discount helpers", () => {
  it("normalizes discount codes", () => {
    expect(normalizeDiscountCode("  save10 ")).toBe("SAVE10");
  });

  it("computes percentage discounts in paise", () => {
    expect(computeDiscountPaise("PERCENTAGE", 10, 10_000)).toBe(1_000);
    expect(computeDiscountPaise("PERCENTAGE", 100, 10_000)).toBe(10_000);
    expect(computeDiscountPaise("PERCENTAGE", 150, 10_000)).toBe(10_000);
  });

  it("computes fixed discounts capped at subtotal", () => {
    expect(computeDiscountPaise("FIXED_PAISE", 2_500, 10_000)).toBe(2_500);
    expect(computeDiscountPaise("FIXED_PAISE", 12_000, 10_000)).toBe(10_000);
  });

  it("computes grand total with GST and flat shipping", () => {
    expect(cartGrandTotalPaise(10_000, 1_000)).toBe(9_000 + 270 + 20_000);
    expect(cartGrandTotalPaise(1_000, 2_000)).toBe(20_000);
  });
});

describe("assertDiscountApplicable", () => {
  const now = new Date("2026-06-15T12:00:00.000Z");

  it("allows an active unlimited discount", () => {
    expect(() => assertDiscountApplicable(baseDiscount(), 5_000, now)).not.toThrow();
  });

  it("rejects inactive discounts", () => {
    expect(() =>
      assertDiscountApplicable(baseDiscount({ status: "INACTIVE" }), 5_000, now),
    ).toThrow(InvalidStateError);
  });

  it("rejects before startsAt", () => {
    expect(() =>
      assertDiscountApplicable(
        baseDiscount({ startsAt: new Date("2026-07-01T00:00:00.000Z") }),
        5_000,
        now,
      ),
    ).toThrow(/not yet active/i);
  });

  it("rejects at or after endsAt", () => {
    expect(() =>
      assertDiscountApplicable(
        baseDiscount({ endsAt: new Date("2026-06-15T12:00:00.000Z") }),
        5_000,
        now,
      ),
    ).toThrow(/expired/i);
  });

  it("allows at startsAt inclusive", () => {
    const startsAt = new Date("2026-06-15T12:00:00.000Z");
    expect(() =>
      assertDiscountApplicable(baseDiscount({ startsAt }), 5_000, startsAt),
    ).not.toThrow();
  });

  it("rejects when subtotal is under min order", () => {
    expect(() =>
      assertDiscountApplicable(baseDiscount({ minOrderPaise: 10_000 }), 9_999, now),
    ).toThrow(/minimum order/i);
  });

  it("rejects when usage limit is reached", () => {
    expect(() =>
      assertDiscountApplicable(
        baseDiscount({ usageLimit: 5, usageCount: 5 }),
        5_000,
        now,
      ),
    ).toThrow(/usage limit/i);
  });
});
