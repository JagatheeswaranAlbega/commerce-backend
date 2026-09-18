declare module "cloudflare:workers" {
  // Minimal ambient module so TypeScript accepts Workers env imports outside Wrangler typegen.
  export const env: {
    HYPERDRIVE?: { connectionString: string };
    PRODUCT_MEDIA?: unknown;
    ENVIRONMENT?: string;
    DATABASE_URL?: string;
    JWT_SECRET?: string;
    FRONTEND_URL?: string;
  };
}
