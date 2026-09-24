declare module "cloudflare:workers" {
  // Minimal ambient module so TypeScript accepts Workers env imports outside Wrangler typegen.
  export const env: {
    HYPERDRIVE?: { connectionString: string };
    PRODUCT_MEDIA?: unknown;
    ENVIRONMENT?: string;
    DATABASE_URL?: string;
    JWT_SECRET?: string;
    FRONTEND_URL?: string;
    ZEPTOMAIL_TOKEN?: string;
    ZEPTOMAIL_FROM?: string;
    ZEPTOMAIL_FROM_NAME?: string;
    ZEPTOMAIL_API_URL?: string;
  };
}
