/** Maximum length for the sanitized filename segment (excluding UUID prefix). */
export const PRODUCT_MEDIA_FILENAME_MAX_LENGTH = 100;

/**
 * Minimal Cloudflare Workers R2Bucket surface used by product media.
 * Matches the Workers runtime binding when `@cloudflare/workers-types` is available.
 */
export interface R2Bucket {
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob | null,
    options?: {
      httpMetadata?: {
        contentType?: string;
      };
    },
  ): Promise<unknown>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(keys: string | string[]): Promise<void>;
}

export interface R2ObjectBody {
  readonly body: ReadableStream | null;
  readonly httpMetadata?: {
    contentType?: string;
  };
}

export type BuildProductMediaKeyInput = {
  storeId: string | null;
  productId: string;
  filename: string;
};

/** Basename only, strip unsafe characters, enforce max length. */
export function sanitizeFilename(filename: string): string {
  const base = filename.replace(/\\/g, "/").split("/").pop()?.trim() || "file";
  const cleaned = base
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._]+/, "")
    .replace(/[._]+$/, "");
  const safe = cleaned.length > 0 ? cleaned : "file";
  return safe.slice(0, PRODUCT_MEDIA_FILENAME_MAX_LENGTH);
}

/**
 * Backend-owned object key.
 * - global: `global/products/{productId}/{uuid}-{sanitizedFilename}`
 * - tenant: `stores/{storeId}/products/{productId}/{uuid}-{sanitizedFilename}`
 */
export function buildProductMediaKey(input: BuildProductMediaKeyInput): string {
  const sanitized = sanitizeFilename(input.filename);
  const objectName = `${crypto.randomUUID()}-${sanitized}`;

  if (input.storeId === null) {
    return `global/products/${input.productId}/${objectName}`;
  }

  return `stores/${input.storeId}/products/${input.productId}/${objectName}`;
}

export async function putObject(
  bucket: R2Bucket,
  key: string,
  body: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob | null,
  contentType: string,
): Promise<void> {
  await bucket.put(key, body, {
    httpMetadata: { contentType },
  });
}

export async function deleteObject(bucket: R2Bucket, key: string): Promise<void> {
  await bucket.delete(key);
}

export async function getObject(bucket: R2Bucket, key: string): Promise<R2ObjectBody | null> {
  return bucket.get(key);
}

export function toR2Url(storageKey: string): string {
  return `r2://${storageKey}`;
}
