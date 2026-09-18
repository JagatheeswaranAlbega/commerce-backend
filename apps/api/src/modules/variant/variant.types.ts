export type VariantStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export type VariantRecord = {
  id: string;
  storeId: string;
  productId: string;
  sku: string;
  title: string;
  pricePaise: number;
  compareAtPricePaise: number | null;
  status: VariantStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type VariantResponse = {
  id: string;
  storeId: string;
  productId: string;
  sku: string;
  title: string;
  pricePaise: number;
  compareAtPricePaise: number | null;
  status: VariantStatus;
  availableQuantity?: number;
  inStock?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateVariantInput = {
  sku: string;
  title: string;
  pricePaise: number;
  compareAtPricePaise?: number | null;
  status?: VariantStatus;
};

export type UpdateVariantInput = {
  sku?: string;
  title?: string;
  pricePaise?: number;
  compareAtPricePaise?: number | null;
  status?: VariantStatus;
};

export function toVariantResponse(
  record: VariantRecord,
  stock?: { availableQuantity: number },
): VariantResponse {
  const availableQuantity = stock?.availableQuantity;
  return {
    id: record.id,
    storeId: record.storeId,
    productId: record.productId,
    sku: record.sku,
    title: record.title,
    pricePaise: record.pricePaise,
    compareAtPricePaise: record.compareAtPricePaise,
    status: record.status,
    ...(availableQuantity !== undefined
      ? {
          availableQuantity,
          inStock: availableQuantity > 0,
        }
      : {}),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
