export type AppEnvironment = "development" | "test" | "staging" | "production";

export type AppEnv = {
  ENVIRONMENT: AppEnvironment;
  DATABASE_URL?: string;
  JWT_SECRET?: string;
  FRONTEND_URL?: string;
  ZEPTOMAIL_TOKEN?: string;
  ZEPTOMAIL_FROM?: string;
  ZEPTOMAIL_FROM_NAME?: string;
  ZEPTOMAIL_API_URL?: string;
};
