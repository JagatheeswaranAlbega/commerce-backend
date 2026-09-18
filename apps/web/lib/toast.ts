import { toast as sonnerToast, type ExternalToast } from "sonner"

const DEFAULT_DURATION = 5000

type ToastType = "success" | "error" | "warning" | "info" | "delete"

const toastOptions = (
  type: ToastType,
  options?: ExternalToast
): ExternalToast => ({
  duration: DEFAULT_DURATION,
  className: `toast-${type}`,
  ...options,
})

/**
 * App toast helpers — always auto-dismiss after 5s with consistent type styles.
 */
export const appToast = {
  success(message: string, options?: ExternalToast) {
    return sonnerToast.success(message, toastOptions("success", options))
  },
  error(message: string, options?: ExternalToast) {
    return sonnerToast.error(message, toastOptions("error", options))
  },
  warning(message: string, options?: ExternalToast) {
    return sonnerToast.warning(message, toastOptions("warning", options))
  },
  info(message: string, options?: ExternalToast) {
    return sonnerToast.info(message, toastOptions("info", options))
  },
  /** Destructive / delete feedback — same visual language as error. */
  delete(message: string, options?: ExternalToast) {
    return sonnerToast.error(message, toastOptions("delete", options))
  },
  dismiss: sonnerToast.dismiss,
}
