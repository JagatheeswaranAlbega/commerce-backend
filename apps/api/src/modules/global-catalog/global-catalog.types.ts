export type ProductStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type CategoryStatus = "ACTIVE" | "INACTIVE";
export type VariantStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type CatalogItemSource = "STORE" | "GLOBAL";

export type GlobalCategoryRecord = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  status: CategoryStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type GlobalProductRecord = {
  id: string;
  categoryId: string | null;
  title: string;
  handle: string;
  shortDescription: string | null;
  description: string | null;
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type GlobalVariantRecord = {
  id: string;
  productId: string;
  sku: string;
  title: string;
  pricePaise: number;
  compareAtPricePaise: number | null;
  status: VariantStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type GlobalImageRecord = {
  id: string;
  productId: string;
  storageKey: string;
  url: string | null;
  altText: string | null;
  sortOrder: number;
  isThumbnail: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type StoreGlobalProductRecord = {
  id: string;
  storeId: string;
  globalProductId: string;
  storeCategoryId: string | null;
  status: CategoryStatus;
  importedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type ImportedGlobalProductRecord = GlobalProductRecord & {
  storeCategoryId: string | null;
};

export type ImportStoreCategoryAssignment =
  | { storeCategoryId: string; newCategory?: undefined }
  | { storeCategoryId?: undefined; newCategory: { name: string; slug: string } };

export type GlobalCategoryResponse = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  status: CategoryStatus;
  createdAt: string;
  updatedAt: string;
};

export type GlobalProductThumbnail = {
  id: string;
  altText: string | null;
  url: string | null;
};

export type GlobalProductResponse = {
  id: string;
  categoryId: string | null;
  storeCategoryId?: string | null;
  title: string;
  handle: string;
  shortDescription: string | null;
  description: string | null;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
  imported?: boolean;
  importCount?: number;
  source?: "GLOBAL";
  thumbnail?: GlobalProductThumbnail | null;
};

export type GlobalVariantResponse = {
  id: string;
  productId: string;
  sku: string;
  title: string;
  pricePaise: number;
  compareAtPricePaise: number | null;
  status: VariantStatus;
  createdAt: string;
  updatedAt: string;
};

export type GlobalImageResponse = {
  id: string;
  productId: string;
  storageKey: string;
  url: string | null;
  altText: string | null;
  sortOrder: number;
  isThumbnail: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateGlobalCategoryInput = {
  name: string;
  slug: string;
  parentId?: string | null;
  status?: CategoryStatus;
};

export type UpdateGlobalCategoryInput = {
  name?: string;
  slug?: string;
  parentId?: string | null;
  status?: CategoryStatus;
};

export type CreateGlobalProductInput = {
  title: string;
  handle: string;
  shortDescription?: string | null;
  description?: string | null;
  status?: ProductStatus;
  categoryId?: string | null;
};

export type UpdateGlobalProductInput = {
  title?: string;
  handle?: string;
  shortDescription?: string | null;
  description?: string | null;
  status?: ProductStatus;
  categoryId?: string | null;
};

export type CreateGlobalVariantInput = {
  sku: string;
  title: string;
  pricePaise: number;
  compareAtPricePaise?: number | null;
  status?: VariantStatus;
};

export type UpdateGlobalVariantInput = {
  sku?: string;
  title?: string;
  pricePaise?: number;
  compareAtPricePaise?: number | null;
  status?: VariantStatus;
};

export type ListGlobalProductsQuery = {
  page: number;
  pageSize: number;
  status?: ProductStatus;
  categoryId?: string;
  q?: string;
  imported?: boolean;
};

export function toGlobalCategoryResponse(record: GlobalCategoryRecord): GlobalCategoryResponse {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    parentId: record.parentId,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toGlobalProductResponse(
  record: GlobalProductRecord,
  extras?: {
    imported?: boolean;
    importCount?: number;
    thumbnail?: GlobalProductThumbnail | null;
    storeCategoryId?: string | null;
  },
): GlobalProductResponse {
  return {
    id: record.id,
    categoryId: record.categoryId,
    title: record.title,
    handle: record.handle,
    shortDescription: record.shortDescription,
    description: record.description,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    source: "GLOBAL",
    ...(extras?.imported !== undefined ? { imported: extras.imported } : {}),
    ...(extras?.importCount !== undefined ? { importCount: extras.importCount } : {}),
    ...(extras?.thumbnail !== undefined ? { thumbnail: extras.thumbnail } : {}),
    ...(extras?.storeCategoryId !== undefined ? { storeCategoryId: extras.storeCategoryId } : {}),
  };
}

export function toGlobalVariantResponse(record: GlobalVariantRecord): GlobalVariantResponse {
  return {
    id: record.id,
    productId: record.productId,
    sku: record.sku,
    title: record.title,
    pricePaise: record.pricePaise,
    compareAtPricePaise: record.compareAtPricePaise,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toGlobalImageResponse(record: GlobalImageRecord): GlobalImageResponse {
  return {
    id: record.id,
    productId: record.productId,
    storageKey: record.storageKey,
    url: record.url,
    altText: record.altText,
    sortOrder: record.sortOrder,
    isThumbnail: record.isThumbnail,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
