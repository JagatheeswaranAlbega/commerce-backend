type R2Bucket = import("./src/infrastructure/r2/product-media").R2Bucket;

interface DurableObjectState {
  storage: {
    get<T>(key: string): Promise<T | undefined>;
    put(key: string, value: unknown): Promise<void>;
  };
  blockConcurrencyWhile<T>(fn: () => Promise<T>): Promise<T>;
}

interface DurableObjectId {
  toString(): string;
}

interface DurableObjectStub {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

interface CloudflareEnv {
  PRODUCT_MEDIA?: R2Bucket;
  HYPERDRIVE?: { connectionString: string };
  INVENTORY?: DurableObjectNamespace;
  ENVIRONMENT?: string;
  DATABASE_URL?: string;
  JWT_SECRET?: string;
  FRONTEND_URL?: string;
}
