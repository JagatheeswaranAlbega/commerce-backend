"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { TriangleAlertIcon } from "lucide-react"

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

type LeaveAction = {
  href?: string
  run?: () => void
}

type GuardHandlers = {
  isDirty: boolean
  onSaveAsDraft: () => Promise<void> | void
}

type NavigationGuardContextValue = {
  register: (handlers: GuardHandlers) => void
  unregister: () => void
  /** Intercept in-app leave; shows dialog when dirty. Returns false if blocked. */
  requestLeave: (action: LeaveAction) => boolean
  isDirty: boolean
}

const NavigationGuardContext = createContext<NavigationGuardContextValue | null>(
  null
)

export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const handlersRef = useRef<GuardHandlers | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [pending, setPending] = useState<LeaveAction | null>(null)
  const [saving, setSaving] = useState(false)

  const register = useCallback((handlers: GuardHandlers) => {
    handlersRef.current = handlers
    setIsDirty(handlers.isDirty)
  }, [])

  const unregister = useCallback(() => {
    handlersRef.current = null
    setIsDirty(false)
    setPending(null)
  }, [])

  const requestLeave = useCallback(
    (action: LeaveAction) => {
      const handlers = handlersRef.current
      if (!handlers?.isDirty) {
        if (action.href) router.push(action.href)
        else action.run?.()
        return true
      }
      setPending(action)
      return false
    },
    [router]
  )

  useEffect(() => {
    if (!isDirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [isDirty])

  async function proceed(action: LeaveAction) {
    setPending(null)
    if (handlersRef.current) {
      handlersRef.current = { ...handlersRef.current, isDirty: false }
      setIsDirty(false)
    }
    if (action.href) router.push(action.href)
    else action.run?.()
  }

  async function onSaveAsDraft() {
    const handlers = handlersRef.current
    const action = pending
    if (!handlers || !action) return
    setSaving(true)
    try {
      await handlers.onSaveAsDraft()
      await proceed(action)
    } catch {
      // Keep dialog open; page-level errors / toasts handle feedback
    } finally {
      setSaving(false)
    }
  }

  function onDiscard() {
    const action = pending
    if (!action) return
    void proceed(action)
  }

  function onCancel() {
    setPending(null)
  }

  const value = useMemo(
    () => ({ register, unregister, requestLeave, isDirty }),
    [register, unregister, requestLeave, isDirty]
  )

  return (
    <NavigationGuardContext.Provider value={value}>
      {children}
      <AlertDialog
        open={Boolean(pending)}
        onOpenChange={(open) => {
          if (!open && !saving) onCancel()
        }}
      >
        <AlertDialogContent size="default">
          <AlertDialogHeader>
            <AlertDialogMedia className="!size-12 rounded-2xl bg-[color-mix(in_oklch,oklch(0.7_0.15_70)_14%,transparent)] text-[oklch(0.7_0.15_70)]">
              <TriangleAlertIcon className="size-5" aria-hidden />
            </AlertDialogMedia>
            <AlertDialogTitle>Are you sure you want to leave?</AlertDialogTitle>
            <AlertDialogDescription>
              Your changes have not been saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:items-stretch">
            <Button
              type="button"
              disabled={saving}
              onClick={() => void onSaveAsDraft()}
            >
              {saving ? "Saving…" : "Save as Draft"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={onDiscard}
            >
              Discard Changes
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={onCancel}
            >
              Cancel
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </NavigationGuardContext.Provider>
  )
}

function useNavigationGuardContext() {
  const ctx = useContext(NavigationGuardContext)
  if (!ctx) {
    throw new Error(
      "useNavigationGuard must be used within NavigationGuardProvider"
    )
  }
  return ctx
}

/**
 * Register dirty-state + draft save for the current page.
 */
export function useUnsavedChangesGuard({
  isDirty,
  onSaveAsDraft,
  enabled = true,
}: {
  isDirty: boolean
  onSaveAsDraft: () => Promise<void> | void
  enabled?: boolean
}) {
  const { register, unregister, requestLeave } = useNavigationGuardContext()
  const saveRef = useRef(onSaveAsDraft)
  saveRef.current = onSaveAsDraft

  useEffect(() => {
    if (!enabled) {
      unregister()
      return
    }
    register({
      isDirty,
      onSaveAsDraft: () => saveRef.current(),
    })
    return () => unregister()
  }, [enabled, isDirty, register, unregister])

  const confirmLeave = useCallback(
    (action: LeaveAction) => requestLeave(action),
    [requestLeave]
  )

  return { confirmLeave, isDirty }
}

type GuardedLinkProps = React.ComponentProps<typeof Link>

/** Drop-in Link that respects the unsaved-changes guard. */
export function GuardedLink({ onNavigate, href, ...props }: GuardedLinkProps) {
  const ctx = useContext(NavigationGuardContext)

  return (
    <Link
      href={href}
      onNavigate={(event) => {
        onNavigate?.(event)
        if (!ctx?.isDirty) return
        event.preventDefault()
        const target =
          typeof href === "string" ? href : (href.pathname ?? undefined)
        if (target) ctx.requestLeave({ href: target })
      }}
      {...props}
    />
  )
}
