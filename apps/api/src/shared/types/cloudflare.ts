import type { R2Bucket } from "@/infrastructure/r2/product-media";

export type InventoryDurableObjectNamespace = {
  idFromName(name: string): { toString(): string };
  get(id: { toString(): string }): {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  };
};

export type CloudflareBindings = {
  HYPERDRIVE?: { connectionString: string };
  PRODUCT_MEDIA?: R2Bucket;
  INVENTORY?: InventoryDurableObjectNamespace;
  ENVIRONMENT?: string;
  DATABASE_URL?: string;
  JWT_SECRET?: string;
  FRONTEND_URL?: string;
};
