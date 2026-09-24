import { z } from "zod";

export const environmentSchema = z.enum(["development", "test", "staging", "production"]);

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional());
const optionalSecret = z.preprocess(emptyToUndefined, z.string().min(32).optional());
const optionalConnectionString = z.preprocess(emptyToUndefined, z.string().min(1).optional());
const optionalToken = z.preprocess(emptyToUndefined, z.string().min(1).optional());
const optionalEmail = z.preprocess(emptyToUndefined, z.string().email().optional());
const optionalName = z.preprocess(emptyToUndefined, z.string().min(1).optional());

export const envSchema = z.object({
  ENVIRONMENT: environmentSchema.default("development"),
  DATABASE_URL: optionalConnectionString,
  JWT_SECRET: optionalSecret,
  FRONTEND_URL: optionalUrl,
  ZEPTOMAIL_TOKEN: optionalToken,
  ZEPTOMAIL_FROM: optionalEmail,
  ZEPTOMAIL_FROM_NAME: optionalName,
  ZEPTOMAIL_API_URL: optionalUrl,
});

export type ParsedEnv = z.infer<typeof envSchema>;
