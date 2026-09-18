export type AppEnvironment = "development" | "test" | "staging" | "production";

export type AppEnv = {
  ENVIRONMENT: AppEnvironment;
  DATABASE_URL?: string;
  JWT_SECRET?: string;
  FRONTEND_URL?: string;
};
