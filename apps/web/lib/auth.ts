import { apiFetch } from "@/lib/api"
import {
  clearSession,
  setSession,
  type AuthRole,
} from "@/lib/auth-cookie"

export type AuthUser = {
  id: string
  email: string
  role: AuthRole
  storeId: string | null
}

export type LoginResult = {
  accessToken: string
  refreshToken?: string | null
  user: AuthUser
}

export function homeForRole(_role?: AuthRole): string {
  return "/admin"
}

export async function login(input: {
  email: string
  password: string
}): Promise<LoginResult> {
  const result = await apiFetch<LoginResult>("/auth/login", {
    method: "POST",
    auth: "none",
    body: JSON.stringify({
      email: input.email,
      password: input.password,
    }),
  })

  setSession({
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    role: result.user.role,
  })

  return result
}

export function getMe(): Promise<AuthUser> {
  return apiFetch<AuthUser>("/auth/me", { auth: "session" })
}

export function changePassword(input: {
  currentPassword: string
  newPassword: string
}): Promise<{ changed: true }> {
  return apiFetch<{ changed: true }>("/auth/change-password", {
    method: "POST",
    auth: "session",
    body: JSON.stringify(input),
  })
}

export async function logout(): Promise<void> {
  try {
    await apiFetch<unknown>("/auth/logout", {
      method: "POST",
      auth: "session",
    })
  } catch {
    // Always clear local session even if the API call fails.
  } finally {
    clearSession()
  }
}
