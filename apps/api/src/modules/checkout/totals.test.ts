import { describe, expect, it } from "vitest";
import {
  FLAT_SHIPPING_PAISE,
  computeCheckoutTotals,
} from "./totals";

describe("computeCheckoutTotals", () => {
  it("applies 3% GST on discounted merchandise plus ₹200 shipping", () => {
    // subtotal ₹1000, discount ₹100 → taxable ₹900 → GST ₹27 → + shipping ₹200
    const totals = computeCheckoutTotals(100_000, 10_000);
    expect(totals.taxablePaise).toBe(90_000);
    expect(totals.taxTotalPaise).toBe(2_700);
    expect(totals.shippingTotalPaise).toBe(FLAT_SHIPPING_PAISE);
    expect(totals.grandTotalPaise).toBe(90_000 + 2_700 + 20_000);
  });

  it("floors GST to whole paise", () => {
    // taxable 10001 * 3% = 300.03 → 300
    expect(computeCheckoutTotals(10_001, 0).taxTotalPaise).toBe(300);
  });

  it("still charges shipping when merchandise is fully discounted", () => {
    const totals = computeCheckoutTotals(5_000, 5_000);
    expect(totals.taxTotalPaise).toBe(0);
    expect(totals.shippingTotalPaise).toBe(FLAT_SHIPPING_PAISE);
    expect(totals.grandTotalPaise).toBe(FLAT_SHIPPING_PAISE);
  });

  it("can omit shipping for empty-cart previews", () => {
    const totals = computeCheckoutTotals(0, 0, { applyShipping: false });
    expect(totals.shippingTotalPaise).toBe(0);
    expect(totals.grandTotalPaise).toBe(0);
  });

  it("supports free_over shipping and custom GST", () => {
    const totals = computeCheckoutTotals(100_000, 0, {
      shipping: { mode: "free_over", flatPaise: 20_000, freeOverPaise: 50_000 },
      tax: { gstPercent: 5 },
    });
    expect(totals.shippingTotalPaise).toBe(0);
    expect(totals.taxTotalPaise).toBe(5_000);
    expect(totals.grandTotalPaise).toBe(105_000);
  });

  it("supports shipping off", () => {
    const totals = computeCheckoutTotals(10_000, 0, {
      shipping: { mode: "off", flatPaise: 20_000 },
    });
    expect(totals.shippingTotalPaise).toBe(0);
  });
});
