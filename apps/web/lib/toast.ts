import { toast } from "@/components/ui/toast"

const DEFAULT_TIMEOUT = 3500

type ToastType = "success" | "error" | "warning" | "info"

type AppToastOptions = {
  description?: string
  timeout?: number
  id?: string
}

function show(type: ToastType, message: string, options?: AppToastOptions) {
  return toast.add({
    id: options?.id ?? `${type}:${message}`,
    type,
    title: message,
    description: options?.description,
    timeout: options?.timeout ?? DEFAULT_TIMEOUT,
    priority: type === "error" ? "high" : "low",
  })
}

/**
 * App toast helpers. Identical messages replace the existing toast
 * instead of stacking a duplicate.
 */
export const appToast = {
  success(message: string, options?: AppToastOptions) {
    return show("success", message, options)
  },
  error(message: string, options?: AppToastOptions) {
    return show("error", message, options)
  },
  warning(message: string, options?: AppToastOptions) {
    return show("warning", message, options)
  },
  info(message: string, options?: AppToastOptions) {
    return show("info", message, options)
  },
  /** Destructive feedback uses the error toast type. */
  delete(message: string, options?: AppToastOptions) {
    return show("error", message, options)
  },
  dismiss(id?: string) {
    toast.close(id)
  },
}
