"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { KeyRound, ScrollText, Store, UserCog } from "lucide-react"
import { z } from "zod"

import { AdminPageHeader } from "@/components/admin/page-header"
import { useUnsavedChangesGuard } from "@/components/admin/navigation-guard"
import { useAdminPermissions } from "@/components/admin/permission-gate"
import { SettingsProfileCard } from "@/components/admin/settings-profile-card"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/lib/api"
import {
  getPlatformSettings,
  updatePlatformSettings,
  type PlatformSettings,
} from "@/lib/api/platform/settings"

const settingsSchema = z.object({
  platformName: z
    .string()
    .min(1, "Platform name is required")
    .max(200, "Name is too long"),
  supportEmail: z
    .string()
    .email("Enter a valid email")
    .or(z.literal(""))
    .optional(),
})

function applySettings(
  data: PlatformSettings,
  setters: {
    setPlatformName: (value: string) => void
    setSupportEmail: (value: string) => void
  }
) {
  setters.setPlatformName(data.platformName ?? "")
  setters.setSupportEmail(data.supportEmail ?? "")
}

export function PlatformSettings() {
  const queryClient = useQueryClient()
  const { user, can, isLoading: permissionsLoading } = useAdminPermissions()
  const canManage = can("settings.manage")

  const [platformName, setPlatformName] = useState("")
  const [supportEmail, setSupportEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{
    platformName?: string
    supportEmail?: string
  }>({})
  const [saved, setSaved] = useState(false)

  const settingsQuery = useQuery({
    queryKey: ["platform", "settings"],
    queryFn: getPlatformSettings,
  })

  const settings = settingsQuery.data

  useEffect(() => {
    if (settings) {
      applySettings(settings, { setPlatformName, setSupportEmail })
    }
  }, [settings])

  useEffect(() => {
    if (!saved) return
    const timer = window.setTimeout(() => setSaved(false), 3000)
    return () => window.clearTimeout(timer)
  }, [saved])

  const saveMutation = useMutation({
    mutationFn: updatePlatformSettings,
    onSuccess: (data) => {
      setSaved(true)
      setError(null)
      setFieldErrors({})
      queryClient.setQueryData(["platform", "settings"], data)
    },
    onError: (cause) => {
      setSaved(false)
      setError(
        cause instanceof ApiError ? cause.message : "Failed to save settings."
      )
    },
  })

  const isDirty = Boolean(
    settings &&
      (platformName.trim() !== (settings.platformName ?? "") ||
        supportEmail.trim() !== (settings.supportEmail ?? ""))
  )

  useUnsavedChangesGuard({
    isDirty,
    enabled: canManage,
    onSaveAsDraft: async () => {
      if (!canManage || !isDirty || saveMutation.isPending) return
      const parsed = settingsSchema.safeParse({
        platformName: platformName.trim(),
        supportEmail: supportEmail.trim(),
      })
      if (!parsed.success) return
      await saveMutation.mutateAsync({
        platformName: parsed.data.platformName,
        supportEmail: parsed.data.supportEmail || null,
      })
    },
  })

  function discard() {
    if (!settings) return
    applySettings(settings, { setPlatformName, setSupportEmail })
    setError(null)
    setFieldErrors({})
    setSaved(false)
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canManage) return
    setSaved(false)
    const parsed = settingsSchema.safeParse({
      platformName: platformName.trim(),
      supportEmail: supportEmail.trim(),
    })
    if (!parsed.success) {
      const next: typeof fieldErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (key === "platformName" || key === "supportEmail") {
          next[key] = issue.message
        }
      }
      setFieldErrors(next)
      return
    }
    setFieldErrors({})
    setError(null)
    saveMutation.mutate({
      platformName: parsed.data.platformName,
      supportEmail: parsed.data.supportEmail || null,
    })
  }

  const fieldsDisabled = !canManage || saveMutation.isPending

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <AdminPageHeader
        title="Settings"
        description="Your account and global platform configuration"
        breadcrumbs={[{ label: "Settings" }]}
      />

      <SettingsProfileCard
        user={user}
        isLoading={permissionsLoading}
        scopeLabel="All stores"
        scopeDescription="Platform Super Admin has global access. Store scope is never implied by a null store ID alone."
      />

      {settingsQuery.isLoading ? (
        <div className="flex flex-col gap-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : settingsQuery.isError ? (
        <Card>
          <CardHeader>
            <CardTitle>Unable to load platform settings</CardTitle>
            <CardDescription>
              {settingsQuery.error instanceof Error
                ? settingsQuery.error.message
                : "Failed to load settings."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <form onSubmit={onSubmit} className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Platform identity</CardTitle>
                <CardDescription>
                  Name and support contact for the overall platform
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup className="gap-5">
                  <Field
                    data-invalid={fieldErrors.platformName ? true : undefined}
                  >
                    <FieldLabel htmlFor="platform-name">
                      Platform name
                    </FieldLabel>
                    <Input
                      id="platform-name"
                      value={platformName}
                      onChange={(e) => setPlatformName(e.target.value)}
                      disabled={fieldsDisabled}
                      placeholder="Commerce Console"
                      aria-invalid={
                        fieldErrors.platformName ? true : undefined
                      }
                    />
                    <FieldDescription>
                      Shown in the admin console branding
                    </FieldDescription>
                    {fieldErrors.platformName ? (
                      <FieldError>{fieldErrors.platformName}</FieldError>
                    ) : null}
                  </Field>
                  <Field
                    data-invalid={fieldErrors.supportEmail ? true : undefined}
                  >
                    <FieldLabel htmlFor="support-email">
                      Support email
                    </FieldLabel>
                    <Input
                      id="support-email"
                      type="email"
                      value={supportEmail}
                      onChange={(e) => setSupportEmail(e.target.value)}
                      disabled={fieldsDisabled}
                      placeholder="support@example.com"
                      aria-invalid={
                        fieldErrors.supportEmail ? true : undefined
                      }
                    />
                    <FieldDescription>
                      Contact address for platform-level support and ops
                    </FieldDescription>
                    {fieldErrors.supportEmail ? (
                      <FieldError>{fieldErrors.supportEmail}</FieldError>
                    ) : null}
                  </Field>
                </FieldGroup>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Defaults</CardTitle>
                <CardDescription>
                  Platform-wide commerce defaults applied to every store
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup className="gap-5">
                  <Field>
                    <FieldLabel htmlFor="default-currency">
                      Default currency
                    </FieldLabel>
                    <Input
                      id="default-currency"
                      value="INR"
                      disabled
                      readOnly
                    />
                    <FieldDescription>
                      All stores use INR. Money is always stored as integer
                      paise.
                    </FieldDescription>
                  </Field>
                </FieldGroup>
              </CardContent>
            </Card>

            {error ? <FieldError>{error}</FieldError> : null}
            {!canManage ? (
              <p className="text-sm text-muted-foreground">
                You can view settings but do not have permission to change them.
              </p>
            ) : null}

            <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 px-1 py-4 backdrop-blur">
              <p className="text-sm text-muted-foreground">
                {saved
                  ? "Settings saved."
                  : isDirty
                    ? "You have unsaved changes."
                    : "No pending changes."}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!isDirty || fieldsDisabled}
                  onClick={discard}
                >
                  Discard
                </Button>
                <Button
                  type="submit"
                  disabled={!isDirty || fieldsDisabled}
                >
                  {saveMutation.isPending ? "Saving..." : "Save settings"}
                </Button>
              </div>
            </div>
          </form>

          <Card>
            <CardHeader>
              <CardTitle>Related</CardTitle>
              <CardDescription>
                Platform tools for stores, access, and audit
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Link
                href="/admin/stores"
                className="flex items-center gap-3 rounded-2xl px-3 py-3 hover:bg-muted/50"
              >
                <Store className="size-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Stores</p>
                  <p className="text-sm text-muted-foreground">
                    Create, activate, and manage merchant stores
                  </p>
                </div>
              </Link>
              <Link
                href="/admin/store-admins"
                className="flex items-center gap-3 rounded-2xl px-3 py-3 hover:bg-muted/50"
              >
                <UserCog className="size-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Store admins</p>
                  <p className="text-sm text-muted-foreground">
                    Accounts scoped to individual stores
                  </p>
                </div>
              </Link>
              <Link
                href="/admin/keys"
                className="flex items-center gap-3 rounded-2xl px-3 py-3 hover:bg-muted/50"
              >
                <KeyRound className="size-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">API keys</p>
                  <p className="text-sm text-muted-foreground">
                    Publishable and secret keys across stores
                  </p>
                </div>
              </Link>
              <Link
                href="/admin/audit-logs"
                className="flex items-center gap-3 rounded-2xl px-3 py-3 hover:bg-muted/50"
              >
                <ScrollText className="size-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Audit logs</p>
                  <p className="text-sm text-muted-foreground">
                    Security-sensitive platform and store actions
                  </p>
                </div>
              </Link>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
