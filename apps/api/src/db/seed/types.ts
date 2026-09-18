import type { ShippingSettings, TaxSettings } from "@/modules/checkout/totals";

export type SeedStoreSettings = {
  currency: "INR";
  timezone: string;
  shipping: ShippingSettings;
  tax: TaxSettings;
};

export type SeedVariantDef = {
  sku: string;
  title: string;
  pricePaise: number;
  compareAtPricePaise?: number;
  availableQuantity: number;
};

export type SeedProductDef = {
  title: string;
  handle: string;
  shortDescription: string;
  description: string;
  /** Category slug (parent or subcategory). */
  categorySlug: string;
  /** Collection slugs to link. */
  collectionSlugs: string[];
  variants: SeedVariantDef[];
};

export type SeedCategoryDef = {
  name: string;
  slug: string;
  parentSlug?: string;
};

export type SeedCollectionDef = {
  name: string;
  slug: string;
  description: string;
};

export type SeedCustomerDef = {
  email: string;
  name: string;
  phone: string;
  address: {
    name: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country?: string;
  };
};

export type SeedDiscountDef = {
  code: string;
  type: "PERCENTAGE" | "FIXED_PAISE";
  value: number;
  minOrderPaise?: number;
  usageLimit?: number;
};

export type SeedOrderItemDef = {
  productHandle: string;
  sku: string;
  quantity: number;
};

export type SeedOrderDef = {
  orderNumber: string;
  customerEmail: string;
  status: "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED";
  discountCode?: string;
  items: SeedOrderItemDef[];
};

export type SeedCartDef = {
  customerEmail: string;
  items: Array<{ sku: string; quantity: number }>;
};

export type DemoStoreSeed = {
  name: string;
  slug: string;
  adminEmail: string;
  orderPrefix: string;
  settings: SeedStoreSettings;
  categories: SeedCategoryDef[];
  collections: SeedCollectionDef[];
  products: SeedProductDef[];
  customers: SeedCustomerDef[];
  discounts: SeedDiscountDef[];
  cart: SeedCartDef;
  orders: SeedOrderDef[];
};

export type FixtureStoreSeed = {
  name: string;
  slug: string;
  adminEmail: string;
};

export type SeededStoreSummary = {
  id: string;
  slug: string;
  adminEmail: string;
  publishableKey: string;
  secretKey: string;
};
