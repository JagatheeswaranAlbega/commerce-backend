import { z } from "zod";

const loginEmailSchema = z
  .string()
  .trim()
  .min(3)
  .max(320)
  .refine((value) => /^[^\s@]+@[^\s@]+$/.test(value), {
    message: "Invalid email",
  });

export const loginBodySchema = z.object({
  email: loginEmailSchema,
  password: z.string().min(1).max(256),
});

export const refreshBodySchema = z.object({
  refreshToken: z.string().min(1).max(512),
});

export const logoutBodySchema = z.object({
  refreshToken: z.string().min(1).max(512).optional(),
});

export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(8).max(256),
});

export type LoginBody = z.infer<typeof loginBodySchema>;
export type RefreshBody = z.infer<typeof refreshBodySchema>;
export type LogoutBody = z.infer<typeof logoutBodySchema>;
export type ChangePasswordBody = z.infer<typeof changePasswordBodySchema>;
