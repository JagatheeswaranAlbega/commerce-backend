export const ACCESS_TOKEN_COOKIE = "access_token"
export const REFRESH_TOKEN_COOKIE = "refresh_token"
export const AUTH_ROLE_COOKIE = "auth_role"

/** Legacy cookies — cleared on login/logout */
const LEGACY_COOKIES = [
  "admin_token",
  "store_token",
  "customer_token",
  "auth_token",
] as const

export const AUTH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24
export const REFRESH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export type AuthRole = "PLATFORM_SUPER_ADMIN" | "STORE_ADMIN"

function readCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null
  }

  const prefix = `${name}=`
  const match = document.cookie
    .split("; ")
    .find((part) => part.startsWith(prefix))

  if (!match) {
    return null
  }

  return decodeURIComponent(match.slice(prefix.length))
}

function writeCookie(name: string, value: string, maxAge: number): void {
  if (typeof document === "undefined") {
    return
  }

  const attributes = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ]

  if (process.env.NODE_ENV === "production") {
    attributes.push("Secure")
  }

  document.cookie = attributes.join("; ")
}

function clearCookie(name: string): void {
  if (typeof document === "undefined") {
    return
  }

  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`
}

function clearLegacyCookies(): void {
  for (const name of LEGACY_COOKIES) {
    clearCookie(name)
  }
}

export function getAccessToken(): string | null {
  return readCookie(ACCESS_TOKEN_COOKIE)
}

export function getRefreshToken(): string | null {
  return readCookie(REFRESH_TOKEN_COOKIE)
}

export function getAuthRole(): AuthRole | null {
  const role = readCookie(AUTH_ROLE_COOKIE)
  if (role === "PLATFORM_SUPER_ADMIN" || role === "STORE_ADMIN") {
    return role
  }
  return null
}

export function setSession(input: {
  accessToken: string
  refreshToken?: string | null
  role: AuthRole
}): void {
  clearLegacyCookies()
  writeCookie(ACCESS_TOKEN_COOKIE, input.accessToken, AUTH_TOKEN_MAX_AGE_SECONDS)
  writeCookie(AUTH_ROLE_COOKIE, input.role, AUTH_TOKEN_MAX_AGE_SECONDS)

  if (input.refreshToken) {
    writeCookie(
      REFRESH_TOKEN_COOKIE,
      input.refreshToken,
      REFRESH_TOKEN_MAX_AGE_SECONDS
    )
  } else {
    clearCookie(REFRESH_TOKEN_COOKIE)
  }
}

export function clearSession(): void {
  clearCookie(ACCESS_TOKEN_COOKIE)
  clearCookie(REFRESH_TOKEN_COOKIE)
  clearCookie(AUTH_ROLE_COOKIE)
  clearLegacyCookies()
}
