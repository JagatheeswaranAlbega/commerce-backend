import { z } from "zod";
import { paginationQuerySchema } from "@/shared/pagination";
import type { ImportStoreCategoryAssignment } from "./global-catalog.types";

const handleSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Handle must be lowercase kebab-case.");

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case.");

export const globalCategoryIdParamSchema = z.object({
  categoryId: z.string().uuid(),
});

export const globalProductIdParamSchema = z.object({
  productId: z.string().uuid(),
});

export const globalVariantIdParamSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid(),
});

export const createGlobalCategoryBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: slugSchema,
  parentId: z.string().uuid().nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const updateGlobalCategoryBodySchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    slug: slugSchema.optional(),
    parentId: z.string().uuid().nullable().optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required." });

export const createGlobalProductBodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  handle: handleSchema,
  shortDescription: z.string().trim().max(500).nullable().optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
  categoryId: z.string().uuid().nullable().optional(),
});

export const updateGlobalProductBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    handle: handleSchema.optional(),
    shortDescription: z.string().trim().max(500).nullable().optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
    categoryId: z.string().uuid().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required." });

export const createGlobalVariantBodySchema = z.object({
  sku: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(200),
  pricePaise: z.number().int().min(0),
  compareAtPricePaise: z.number().int().min(0).nullable().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
});

export const updateGlobalVariantBodySchema = z
  .object({
    sku: z.string().trim().min(1).max(100).optional(),
    title: z.string().trim().min(1).max(200).optional(),
    pricePaise: z.number().int().min(0).optional(),
    compareAtPricePaise: z.number().int().min(0).nullable().optional(),
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required." });

export const listGlobalProductsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
  categoryId: z.string().uuid().optional(),
  q: z.string().trim().min(1).max(200).optional(),
  imported: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (typeof v === "boolean") return v;
      return v === "true";
    }),
});

export const listGlobalCategoriesQuerySchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

const newStoreCategorySchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: slugSchema,
});

export const importStoreCategoryAssignmentSchema = z
  .object({
    storeCategoryId: z.string().uuid().optional(),
    newCategory: newStoreCategorySchema.optional(),
  })
  .refine((value) => Boolean(value.storeCategoryId) !== Boolean(value.newCategory), {
    message: "Provide either storeCategoryId or newCategory.",
  });

export const importGlobalProductBodySchema = importStoreCategoryAssignmentSchema;

export const remapImportedProductBodySchema = importStoreCategoryAssignmentSchema;

export const bulkImportGlobalProductsBodySchema = z
  .object({
    productIds: z.array(z.string().uuid()).min(1).max(50),
    storeCategoryId: z.string().uuid().optional(),
    newCategory: newStoreCategorySchema.optional(),
  })
  .refine((value) => Boolean(value.storeCategoryId) !== Boolean(value.newCategory), {
    message: "Provide either storeCategoryId or newCategory.",
  });

export function toImportAssignment(data: {
  storeCategoryId?: string;
  newCategory?: { name: string; slug: string };
}): ImportStoreCategoryAssignment {
  if (data.newCategory) {
    return { newCategory: data.newCategory };
  }
  return { storeCategoryId: data.storeCategoryId! };
}
