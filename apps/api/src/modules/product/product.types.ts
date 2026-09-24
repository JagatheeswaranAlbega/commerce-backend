export type ProductStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export type ProductRecord = {
  id: string;
  storeId: string;
  categoryId: string | null;
  title: string;
  handle: string;
  shortDescription: string | null;
  description: string | null;
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type ProductResponse = {
  id: string;
  storeId: string;
  categoryId: string | null;
  title: string;
  handle: string;
  shortDescription: string | null;
  description: string | null;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
  /** Present when listing/detailing imported global masters in a store context. */
  source?: "STORE" | "GLOBAL";
  platformManaged?: boolean;
};

export type CreateProductInput = {
  title: string;
  handle: string;
  shortDescription?: string | null;
  description?: string | null;
  status?: ProductStatus;
  categoryId?: string | null;
};

export type UpdateProductInput = {
  title?: string;
  handle?: string;
  shortDescription?: string | null;
  description?: string | null;
  status?: ProductStatus;
  categoryId?: string | null;
};

export type ListProductsResult = {
  items: ProductRecord[];
  total: number;
};

export type ListStoreProductsQuery = {
  page: number;
  pageSize: number;
  status?: ProductStatus;
  categoryId?: string;
  q?: string;
  source?: "STORE" | "GLOBAL";
};

export type ListAdminProductsQuery = {
  page: number;
  pageSize: number;
  storeId?: string;
  status?: ProductStatus;
};

export type ListCatalogProductsQuery = {
  page: number;
  pageSize: number;
  categoryId?: string;
  collectionId?: string;
  q?: string;
  sort?: "created_at_desc" | "price_asc" | "price_desc";
  inStock?: boolean;
  minPricePaise?: number;
  maxPricePaise?: number;
};

export type CatalogProductPricing = {
  minPricePaise: number | null;
  maxPricePaise: number | null;
  compareAtPricePaise: number | null;
  inStock: boolean;
};

export type CatalogProductResponse = ProductResponse &
  CatalogProductPricing & {
    source?: "STORE" | "GLOBAL";
  };

export function toProductResponse(record: ProductRecord): ProductResponse {
  return {
    id: record.id,
    storeId: record.storeId,
    categoryId: record.categoryId,
    title: record.title,
    handle: record.handle,
    shortDescription: record.shortDescription,
    description: record.description,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
