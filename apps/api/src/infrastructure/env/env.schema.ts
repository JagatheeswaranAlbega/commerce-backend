import { z } from "zod";

export const environmentSchema = z.enum(["development", "test", "staging", "production"]);

const optionalUrl = z.string().url().optional();
const optionalSecret = z.string().min(32).optional();
const optionalConnectionString = z.string().min(1).optional();

export const envSchema = z.object({
  ENVIRONMENT: environmentSchema.default("development"),
  DATABASE_URL: optionalConnectionString,
  JWT_SECRET: optionalSecret,
  FRONTEND_URL: optionalUrl,
});

export type ParsedEnv = z.infer<typeof envSchema>;
