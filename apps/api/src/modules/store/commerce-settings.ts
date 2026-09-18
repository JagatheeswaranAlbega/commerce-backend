import { eq } from "drizzle-orm";
import { storeSettings } from "@/db/schema/store-settings";
import type { Database } from "@/db/client";
import {
  DEFAULT_SHIPPING_SETTINGS,
  DEFAULT_TAX_SETTINGS,
  type ShippingMode,
  type ShippingSettings,
  type TaxSettings,
} from "@/modules/checkout/totals";

export type StoreCommerceSettings = {
  shipping: ShippingSettings;
  tax: TaxSettings;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseShipping(value: unknown): ShippingSettings {
  const record = asRecord(value);
  if (!record) return { ...DEFAULT_SHIPPING_SETTINGS };

  const modeRaw = typeof record.mode === "string" ? record.mode : "flat";
  const mode: ShippingMode =
    modeRaw === "free_over" || modeRaw === "off" || modeRaw === "flat" ? modeRaw : "flat";
  const flatPaise =
    typeof record.flatPaise === "number" && Number.isFinite(record.flatPaise)
      ? Math.max(0, Math.floor(record.flatPaise))
      : DEFAULT_SHIPPING_SETTINGS.flatPaise;
  const freeOverPaise =
    typeof record.freeOverPaise === "number" && Number.isFinite(record.freeOverPaise)
      ? Math.max(0, Math.floor(record.freeOverPaise))
      : null;

  return { mode, flatPaise, freeOverPaise };
}

function parseTax(value: unknown): TaxSettings {
  const record = asRecord(value);
  if (!record) return { ...DEFAULT_TAX_SETTINGS };

  const gstPercent =
    typeof record.gstPercent === "number" && Number.isFinite(record.gstPercent)
      ? Math.max(0, record.gstPercent)
      : DEFAULT_TAX_SETTINGS.gstPercent;
  const gstin =
    typeof record.gstin === "string" && record.gstin.trim().length > 0
      ? record.gstin.trim()
      : null;

  return { gstPercent, gstin };
}

export async function loadStoreCommerceSettings(
  db: Database,
  storeId: string,
): Promise<StoreCommerceSettings> {
  const items = await db.query.storeSettings.findMany({
    where: eq(storeSettings.storeId, storeId),
  });
  const map = Object.fromEntries(items.map((item) => [item.key, item.value]));
  return {
    shipping: parseShipping(map.shipping),
    tax: parseTax(map.tax),
  };
}

export function shippingSettingsSchemaShape() {
  return {
    mode: ["flat", "free_over", "off"] as const,
    flatPaise: "integer paise >= 0",
    freeOverPaise: "integer paise >= 0 or null",
  };
}
