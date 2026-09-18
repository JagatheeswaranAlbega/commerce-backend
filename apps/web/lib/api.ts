import { getAccessToken } from "@/lib/auth-cookie"
import { appToast } from "@/lib/toast"

export type ApiErrorItem = {
  code: string
  message?: string
  details?: unknown
}

export type PaginationMeta = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type ApiSuccessResponse<T> = {
  status: "success"
  message: string
  data: T
  pagination?: PaginationMeta
}

export type ApiErrorResponse = {
  status: "error"
  message: string
  errors?: ApiErrorItem[]
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string | null

  constructor(message: string, status: number, code: string | null = null) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
  }
}

export type ApiAuthMode = "session" | "none"

export type ApiFetchOptions = RequestInit & {
  auth?: ApiAuthMode
  /** Skip toast notifications for this request (e.g. background probes). */
  silent?: boolean
}

function getApiBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL?.trim()

  if (!baseUrl) {
    throw new ApiError("API URL is not configured.", 500)
  }

  return baseUrl.replace(/\/$/, "")
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isMutatingMethod(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())
}

function canToast(): boolean {
  return typeof window !== "undefined"
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function throwApiError(
  body: unknown,
  status: number,
  options: { toastError: boolean }
): never {
  const message =
    isRecord(body) && typeof body.message === "string"
      ? body.message
      : "An unexpected error occurred"
  const code =
    isRecord(body) &&
    Array.isArray(body.errors) &&
    body.errors.length > 0 &&
    isRecord(body.errors[0]) &&
    typeof body.errors[0].code === "string"
      ? body.errors[0].code
      : null

  if (options.toastError && canToast()) {
    appToast.error(message)
  }

  throw new ApiError(message, status, code)
}

function buildHeaders(init: RequestInit, auth: ApiAuthMode): Headers {
  const headers = new Headers(init.headers)
  const isFormData =
    typeof FormData !== "undefined" && init.body instanceof FormData

  if (init.body && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  if (auth === "session") {
    const token = getAccessToken()
    if (token) {
      headers.set("Authorization", `Bearer ${token}`)
    }
  }

  return headers
}

function notifySuccess(body: ApiSuccessResponse<unknown>, method: string, silent?: boolean) {
  if (silent || !canToast() || !isMutatingMethod(method)) return
  if (typeof body.message === "string" && body.message.trim()) {
    appToast.success(body.message)
  }
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { auth = "none", silent = false, ...init } = options
  const method = (init.method ?? "GET").toUpperCase()
  const toastOnMutate = !silent && isMutatingMethod(method)

  let response: Response
  try {
    response = await fetch(`${getApiBaseUrl()}/api/v1${path}`, {
      ...init,
      method,
      headers: buildHeaders(init, auth),
    })
  } catch {
    if (toastOnMutate && canToast()) {
      appToast.error("An unexpected error occurred")
    }
    throw new ApiError("An unexpected error occurred", 0)
  }

  if (response.status === 204) {
    return undefined as T
  }

  const body = await parseJson(response)

  if (isRecord(body) && body.status === "success" && "data" in body) {
    const success = body as ApiSuccessResponse<T>
    notifySuccess(success, method, silent)
    return success.data
  }

  throwApiError(body, response.status, { toastError: toastOnMutate })
}

export async function apiFetchList<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<{ data: T; pagination?: PaginationMeta }> {
  const { auth = "none", silent = false, ...init } = options
  const method = (init.method ?? "GET").toUpperCase()
  const toastOnMutate = !silent && isMutatingMethod(method)

  let response: Response
  try {
    response = await fetch(`${getApiBaseUrl()}/api/v1${path}`, {
      ...init,
      method,
      headers: buildHeaders(init, auth),
    })
  } catch {
    if (toastOnMutate && canToast()) {
      appToast.error("An unexpected error occurred")
    }
    throw new ApiError("An unexpected error occurred", 0)
  }

  const body = await parseJson(response)

  if (isRecord(body) && body.status === "success" && "data" in body) {
    const success = body as ApiSuccessResponse<T>
    notifySuccess(success, method, silent)
    return {
      data: success.data,
      pagination: success.pagination,
    }
  }

  throwApiError(body, response.status, { toastError: toastOnMutate })
}

export function toQueryString(
  params: Record<string, string | number | boolean | undefined | null>
): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue
    search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ""
}
