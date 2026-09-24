import { z } from "zod";

export const CUSTOMER_GENDERS = ["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"] as const;
export type CustomerGender = (typeof CUSTOMER_GENDERS)[number];

export const customerGenderSchema = z.enum(CUSTOMER_GENDERS);

function isCalendarDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export const customerDateOfBirthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
  .refine(isCalendarDate, "Invalid date.")
  .refine(
    (value) => value <= new Date().toISOString().slice(0, 10),
    "Date of birth cannot be in the future.",
  );

export const updateCustomerProfileSchema = z
  .object({
    name: z.string().min(1).optional(),
    phone: z.string().nullable().optional(),
    dateOfBirth: customerDateOfBirthSchema.nullable().optional(),
    gender: customerGenderSchema.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

export const addressBodySchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().optional(),
  postalCode: z.string().min(1),
  country: z.string().optional(),
  isDefault: z.boolean().optional(),
});

export const updateAddressBodySchema = addressBodySchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one field is required." },
);

export const saveCartShippingSchema = z.object({
  isDefault: z.boolean().optional(),
});
