import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import {
  ACCESS_TOKEN_COOKIE,
  AUTH_ROLE_COOKIE,
  type AuthRole,
} from "@/lib/auth-cookie"

function getRole(request: NextRequest): AuthRole | null {
  const role = request.cookies.get(AUTH_ROLE_COOKIE)?.value
  if (role === "PLATFORM_SUPER_ADMIN" || role === "STORE_ADMIN") {
    return role
  }
  return null
}

function hasSession(request: NextRequest): boolean {
  return Boolean(request.cookies.get(ACCESS_TOKEN_COOKIE)?.value)
}

function homeForRole(_role?: AuthRole): string {
  return "/admin"
}

/** Map legacy /platform paths onto the unified /admin namespace. */
function platformToAdminPath(pathname: string): string {
  if (pathname === "/platform" || pathname === "/platform/") {
    return "/admin"
  }

  const rest = pathname.slice("/platform".length)
  if (rest === "/api-keys" || rest.startsWith("/api-keys/")) {
    return `/admin/keys${rest.slice("/api-keys".length)}`
  }

  return `/admin${rest}`
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const session = hasSession(request)
  const role = getRole(request)

  // Legacy redirects
  if (pathname === "/admin/login" || pathname === "/store/login") {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  if (pathname === "/store" || pathname.startsWith("/store/")) {
    const target = session && role ? homeForRole(role) : "/login"
    return NextResponse.redirect(new URL(target, request.url))
  }

  if (pathname === "/shop" || pathname.startsWith("/shop/")) {
    return NextResponse.next()
  }

  if (pathname === "/platform" || pathname.startsWith("/platform/")) {
    const target = platformToAdminPath(pathname)
    const url = request.nextUrl.clone()
    url.pathname = target
    return NextResponse.redirect(url)
  }

  if (pathname === "/") {
    if (session && role) {
      return NextResponse.redirect(new URL(homeForRole(role), request.url))
    }
    return NextResponse.redirect(new URL("/login", request.url))
  }

  const isLogin = pathname === "/login"
  const isAdmin =
    (pathname === "/admin" || pathname.startsWith("/admin/")) &&
    pathname !== "/admin/login"

  if (isLogin) {
    if (session && role) {
      return NextResponse.redirect(new URL(homeForRole(role), request.url))
    }
    return NextResponse.next()
  }

  if (isAdmin) {
    if (!session || !role) {
      return NextResponse.redirect(new URL("/login", request.url))
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
