"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ChevronRight,
  KeyRound,
  ScrollText,
  Settings2,
  Shield,
  Store,
  UserCog,
  UserRound,
} from "lucide-react"
import { z } from "zod"

import { AdminPageHeader } from "@/components/admin/page-header"
import { useUnsavedChangesGuard } from "@/components/admin/navigation-guard"
import { useAdminPermissions } from "@/components/admin/permission-gate"
import { SettingsProfileCard } from "@/components/admin/settings-profile-card"
import {
  SettingsSectionLayout,
  type SettingsSection,
} from "@/components/admin/settings-section-layout"
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

const PLATFORM_SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: "profile",
    label: "Profile",
    description: "Account & password",
    icon: UserRound,
  },
  {
    id: "identity",
    label: "Platform identity",
    description: "Name & support",
    icon: Shield,
  },
  {
    id: "defaults",
    label: "Defaults",
    description: "Commerce defaults",
    icon: Settings2,
  },
  {
    id: "related",
    label: "Related",
    description: "Stores & access",
    icon: KeyRound,
  },
]

const FORM_SECTIONS = new Set(["identity", "defaults"])

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

function SettingsSaveBar({
  saved,
  isDirty,
  fieldsDisabled,
  canManage,
  error,
  onDiscard,
  savePending,
}: {
  saved: boolean
  isDirty: boolean
  fieldsDisabled: boolean
  canManage: boolean
  error: string | null
  onDiscard: () => void
  savePending: boolean
}) {
  return (
    <div className="flex flex-col gap-3">
      {error ? <FieldError>{error}</FieldError> : null}
      {!canManage ? (
        <p className="text-sm text-muted-foreground">
          You can view settings but do not have permission to change them.
        </p>
      ) : null}
      <div className="admin-panel sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
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
            onClick={onDiscard}
          >
            Discard
          </Button>
          <Button type="submit" disabled={!isDirty || fieldsDisabled}>
            {savePending ? "Saving..." : "Save settings"}
          </Button>
        </div>
      </div>
    </div>
  )
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

  function renderPlatformPanel(section: string) {
    if (settingsQuery.isLoading) {
      return <Skeleton className="h-48 w-full" />
    }

    if (settingsQuery.isError) {
      return (
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
      )
    }

    if (section === "related") {
      return (
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Related</CardTitle>
            <CardDescription>
              Platform tools for stores, access, and audit
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 pt-(--card-spacing)">
            {(
              [
                {
                  href: "/admin/stores",
                  icon: Store,
                  title: "Stores",
                  description: "Create, activate, and manage merchant stores",
                },
                {
                  href: "/admin/store-admins",
                  icon: UserCog,
                  title: "Store admins",
                  description: "Accounts scoped to individual stores",
                },
                {
                  href: "/admin/keys",
                  icon: KeyRound,
                  title: "API keys",
                  description: "Publishable and secret keys across stores",
                },
                {
                  href: "/admin/audit-logs",
                  icon: ScrollText,
                  title: "Audit logs",
                  description: "Security-sensitive platform and store actions",
                },
              ] as const
            ).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center gap-3 rounded-xl border border-border/70 bg-muted/20 px-3.5 py-3.5 transition-colors hover:border-border hover:bg-muted/45"
              >
                <span className="admin-kpi-icon">
                  <item.icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </CardContent>
        </Card>
      )
    }

    if (!FORM_SECTIONS.has(section)) return null

    return (
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {section === "identity" ? (
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
                  <FieldLabel htmlFor="platform-name">Platform name</FieldLabel>
                  <Input
                    id="platform-name"
                    value={platformName}
                    onChange={(e) => setPlatformName(e.target.value)}
                    disabled={fieldsDisabled}
                    placeholder="Commerce Console"
                    aria-invalid={fieldErrors.platformName ? true : undefined}
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
                  <FieldLabel htmlFor="support-email">Support email</FieldLabel>
                  <Input
                    id="support-email"
                    type="email"
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    disabled={fieldsDisabled}
                    placeholder="support@example.com"
                    aria-invalid={fieldErrors.supportEmail ? true : undefined}
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
        ) : null}

        {section === "defaults" ? (
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
                  <Input id="default-currency" value="INR" disabled readOnly />
                  <FieldDescription>
                    All stores use INR. Money is always stored as integer paise.
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        ) : null}

        <SettingsSaveBar
          saved={saved}
          isDirty={isDirty}
          fieldsDisabled={fieldsDisabled}
          canManage={canManage}
          error={error}
          onDiscard={discard}
          savePending={saveMutation.isPending}
        />
      </form>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader
        title="Settings"
        description="Your account and global platform configuration"
        breadcrumbs={[{ label: "Settings" }]}
      />

      <SettingsSectionLayout
        sections={PLATFORM_SETTINGS_SECTIONS}
        defaultSection="profile"
      >
        {(section) =>
          section === "profile" ? (
            <SettingsProfileCard
              user={user}
              isLoading={permissionsLoading}
              scopeLabel="All stores"
              scopeDescription="Platform Super Admin has global access. Store scope is never implied by a null store ID alone."
            />
          ) : (
            renderPlatformPanel(section)
          )
        }
      </SettingsSectionLayout>
    </div>
  )
}
