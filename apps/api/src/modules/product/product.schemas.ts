import { z } from "zod";
import { paginationQuerySchema } from "@/shared/pagination";

const handleSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Handle must be lowercase kebab-case.");

export const productIdParamSchema = z.object({
  productId: z.string().uuid(),
});

export const productHandleParamSchema = z.object({
  handle: handleSchema,
});

export const createProductBodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  handle: handleSchema,
  shortDescription: z.string().trim().max(500).nullable().optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
  categoryId: z.string().uuid().nullable().optional(),
});

export const updateProductBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    handle: handleSchema.optional(),
    shortDescription: z.string().trim().max(500).nullable().optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
    categoryId: z.string().uuid().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required." });

export const listProductsQuerySchema = paginationQuerySchema.extend({
  storeId: z.string().uuid().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
  categoryId: z.string().uuid().optional(),
  q: z.string().trim().min(1).max(200).optional(),
  source: z.enum(["STORE", "GLOBAL"]).optional(),
});

export const listStorefrontProductsQuerySchema = paginationQuerySchema.extend({
  categoryId: z.string().uuid().optional(),
  collectionId: z.string().uuid().optional(),
  q: z.string().trim().min(1).max(200).optional(),
  sort: z.enum(["created_at_desc", "price_asc", "price_desc"]).optional(),
  inStock: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (typeof v === "boolean") return v;
      return v === "true";
    }),
  minPricePaise: z.coerce.number().int().min(0).optional(),
  maxPricePaise: z.coerce.number().int().min(0).optional(),
});
