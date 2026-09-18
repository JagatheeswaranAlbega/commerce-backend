/** Default GST rate applied to discounted merchandise (paise). */
export const GST_PERCENT = 3;

/** Default flat shipping charge in paise (₹200). */
export const FLAT_SHIPPING_PAISE = 20_000;

export type ShippingMode = "flat" | "free_over" | "off";

export type ShippingSettings = {
  mode: ShippingMode;
  flatPaise: number;
  freeOverPaise?: number | null;
};

export type TaxSettings = {
  gstPercent: number;
  gstin?: string | null;
};

export type CheckoutTotalsOptions = {
  applyShipping?: boolean;
  shipping?: ShippingSettings;
  tax?: TaxSettings;
};

export type CheckoutTotals = {
  taxablePaise: number;
  taxTotalPaise: number;
  shippingTotalPaise: number;
  grandTotalPaise: number;
};

export const DEFAULT_SHIPPING_SETTINGS: ShippingSettings = {
  mode: "flat",
  flatPaise: FLAT_SHIPPING_PAISE,
  freeOverPaise: null,
};

export const DEFAULT_TAX_SETTINGS: TaxSettings = {
  gstPercent: GST_PERCENT,
  gstin: null,
};

function resolveShippingPaise(
  taxablePaise: number,
  shipping: ShippingSettings,
): number {
  if (shipping.mode === "off") return 0;
  const flat = Math.max(0, Math.floor(shipping.flatPaise));
  if (shipping.mode === "free_over") {
    const threshold = Math.max(0, Math.floor(shipping.freeOverPaise ?? 0));
    if (threshold > 0 && taxablePaise >= threshold) return 0;
  }
  return flat;
}

/**
 * Checkout money math (INR paise only).
 * GST on (subtotal − discount); shipping from store settings (defaults: 3%, ₹200).
 */
export function computeCheckoutTotals(
  subtotalPaise: number,
  discountTotalPaise: number,
  options?: CheckoutTotalsOptions,
): CheckoutTotals {
  const subtotal = Math.max(0, Math.floor(subtotalPaise));
  const discount = Math.min(Math.max(0, Math.floor(discountTotalPaise)), subtotal);
  const taxablePaise = subtotal - discount;
  const tax = options?.tax ?? DEFAULT_TAX_SETTINGS;
  const gstPercent = Math.max(0, tax.gstPercent);
  const taxTotalPaise =
    taxablePaise <= 0 || gstPercent <= 0
      ? 0
      : Math.floor((taxablePaise * gstPercent) / 100);
  const shipping =
    options?.applyShipping === false
      ? 0
      : resolveShippingPaise(taxablePaise, options?.shipping ?? DEFAULT_SHIPPING_SETTINGS);
  const grandTotalPaise = taxablePaise + taxTotalPaise + shipping;
  return {
    taxablePaise,
    taxTotalPaise,
    shippingTotalPaise: shipping,
    grandTotalPaise,
  };
}
