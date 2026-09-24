"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Check,
  ChevronRight,
  Copy,
  Globe2,
  KeyRound,
  MapPin,
  Percent,
  Store,
  Truck,
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
import { Badge } from "@/components/ui/badge"
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
  getAdminSettings,
  updateAdminSettings,
  type AdminStoreSettings,
  type ShippingMode,
} from "@/lib/api/admin/settings"

const STORE_SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: "profile",
    label: "Profile",
    description: "Account & password",
    icon: UserRound,
  },
  {
    id: "general",
    label: "General",
    description: "Name & status",
    icon: Store,
  },
  {
    id: "storefront",
    label: "Storefront",
    description: "Domain & contact",
    icon: Globe2,
  },
  {
    id: "regional",
    label: "Regional",
    description: "Currency & timezone",
    icon: MapPin,
  },
  {
    id: "shipping",
    label: "Shipping",
    description: "Checkout rates",
    icon: Truck,
  },
  {
    id: "tax",
    label: "Tax",
    description: "GST & GSTIN",
    icon: Percent,
  },
  {
    id: "related",
    label: "Related",
    description: "API keys & more",
    icon: KeyRound,
  },
]

const FORM_SECTIONS = new Set([
  "general",
  "storefront",
  "regional",
  "shipping",
  "tax",
])

const TIMEZONES = [
  { value: "Asia/Kolkata", label: "India Standard Time — Asia/Kolkata" },
  { value: "Asia/Dubai", label: "Gulf Standard Time — Asia/Dubai" },
  { value: "Asia/Singapore", label: "Singapore Time — Asia/Singapore" },
  { value: "UTC", label: "Coordinated Universal Time — UTC" },
  { value: "Europe/London", label: "UK Time — Europe/London" },
  { value: "America/New_York", label: "US Eastern — America/New_York" },
] as const

const SHIPPING_MODE_OPTIONS: Array<{ value: ShippingMode; label: string }> = [
  { value: "flat", label: "Flat rate" },
  { value: "free_over", label: "Free over threshold" },
  { value: "off", label: "Off (free shipping)" },
]

const settingsSchema = z.object({
  name: z.string().min(1, "Store name is required").max(200, "Name is too long"),
  domain: z
    .string()
    .max(255, "Domain is too long")
    .refine((value) => !value || !/\s/.test(value), "Domain cannot contain spaces")
    .optional(),
  contactEmail: z
    .string()
    .email("Enter a valid email")
    .or(z.literal(""))
    .optional(),
  timezone: z.string().min(1, "Timezone is required"),
  shippingMode: z.enum(["flat", "free_over", "off"]),
  flatRupees: z
    .string()
    .trim()
    .refine((value) => {
      if (value === "") return true
      const n = Number(value)
      return Number.isFinite(n) && n >= 0
    }, "Enter a valid shipping amount in rupees"),
  freeOverRupees: z
    .string()
    .trim()
    .refine((value) => {
      if (value === "") return true
      const n = Number(value)
      return Number.isFinite(n) && n >= 0
    }, "Enter a valid free-shipping threshold in rupees"),
  gstPercent: z
    .string()
    .trim()
    .refine((value) => {
      const n = Number(value)
      return Number.isFinite(n) && n >= 0 && n <= 100
    }, "GST percent must be between 0 and 100"),
  gstin: z.string().trim().max(32, "GSTIN is too long").optional(),
})

const selectClassName =
  "h-9 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none transition-[color,box-shadow,background-color,border-color] hover:border-border focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/20"

function normalizeDomain(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
}

function paiseToRupeeInput(paise: number | null | undefined) {
  if (paise == null || !Number.isFinite(paise)) return ""
  return String(paise / 100)
}

function rupeesToPaise(value: string) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100)
}

function applySettings(
  data: AdminStoreSettings,
  setters: {
    setName: (value: string) => void
    setDomain: (value: string) => void
    setContactEmail: (value: string) => void
    setTimezone: (value: string) => void
    setShippingMode: (value: ShippingMode) => void
    setFlatRupees: (value: string) => void
    setFreeOverRupees: (value: string) => void
    setGstPercent: (value: string) => void
    setGstin: (value: string) => void
  }
) {
  setters.setName(data.name ?? "")
  setters.setDomain(data.domain ?? "")
  setters.setContactEmail(data.contactEmail ?? "")
  setters.setTimezone(data.timezone ?? "Asia/Kolkata")
  setters.setShippingMode(data.shipping?.mode ?? "flat")
  setters.setFlatRupees(paiseToRupeeInput(data.shipping?.flatPaise ?? 20000))
  setters.setFreeOverRupees(
    paiseToRupeeInput(data.shipping?.freeOverPaise ?? null)
  )
  setters.setGstPercent(String(data.tax?.gstPercent ?? 3))
  setters.setGstin(data.tax?.gstin ?? "")
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

export function StoreSettings() {
  const queryClient = useQueryClient()
  const { user, can, isLoading: permissionsLoading } = useAdminPermissions()
  const canManage = can("settings.manage")

  const [name, setName] = useState("")
  const [domain, setDomain] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [timezone, setTimezone] = useState("Asia/Kolkata")
  const [shippingMode, setShippingMode] = useState<ShippingMode>("flat")
  const [flatRupees, setFlatRupees] = useState("200")
  const [freeOverRupees, setFreeOverRupees] = useState("")
  const [gstPercent, setGstPercent] = useState("3")
  const [gstin, setGstin] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string
    domain?: string
    contactEmail?: string
    timezone?: string
    shippingMode?: string
    flatRupees?: string
    freeOverRupees?: string
    gstPercent?: string
    gstin?: string
  }>({})
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  const settingsQuery = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: getAdminSettings,
  })

  const settings = settingsQuery.data

  useEffect(() => {
    if (settings) {
      applySettings(settings, {
        setName,
        setDomain,
        setContactEmail,
        setTimezone,
        setShippingMode,
        setFlatRupees,
        setFreeOverRupees,
        setGstPercent,
        setGstin,
      })
    }
  }, [settings])

  useEffect(() => {
    if (!saved) return
    const timer = window.setTimeout(() => setSaved(false), 3000)
    return () => window.clearTimeout(timer)
  }, [saved])

  const saveMutation = useMutation({
    mutationFn: updateAdminSettings,
    onSuccess: (data) => {
      setSaved(true)
      setError(null)
      setFieldErrors({})
      queryClient.setQueryData(["admin", "settings"], data)
    },
    onError: (cause) => {
      setSaved(false)
      setError(
        cause instanceof ApiError ? cause.message : "Failed to save settings."
      )
    },
  })

  const currentFlatPaise = settings?.shipping?.flatPaise ?? 20000
  const currentFreeOverPaise = settings?.shipping?.freeOverPaise ?? null
  const currentGstPercent = settings?.tax?.gstPercent ?? 3
  const currentGstin = settings?.tax?.gstin ?? ""
  const currentShippingMode = settings?.shipping?.mode ?? "flat"

  const isDirty = Boolean(
    settings &&
      (name.trim() !== (settings.name ?? "") ||
        domain.trim() !== (settings.domain ?? "") ||
        contactEmail.trim() !== (settings.contactEmail ?? "") ||
        timezone !== (settings.timezone ?? "Asia/Kolkata") ||
        shippingMode !== currentShippingMode ||
        rupeesToPaise(flatRupees || "0") !== currentFlatPaise ||
        (shippingMode === "free_over"
          ? rupeesToPaise(freeOverRupees || "0") !== (currentFreeOverPaise ?? 0)
          : false) ||
        Number(gstPercent) !== currentGstPercent ||
        gstin.trim() !== currentGstin)
  )

  function buildPayload(parsed: z.infer<typeof settingsSchema>) {
    return {
      name: parsed.name,
      domain: parsed.domain || null,
      contactEmail: parsed.contactEmail || null,
      timezone: parsed.timezone,
      shipping: {
        mode: parsed.shippingMode,
        flatPaise: rupeesToPaise(parsed.flatRupees || "0"),
        freeOverPaise:
          parsed.shippingMode === "free_over"
            ? rupeesToPaise(parsed.freeOverRupees || "0")
            : null,
      },
      tax: {
        gstPercent: Number(parsed.gstPercent),
        gstin: parsed.gstin?.trim() || null,
      },
    }
  }

  function parseForm() {
    return settingsSchema.safeParse({
      name: name.trim(),
      domain: normalizeDomain(domain),
      contactEmail: contactEmail.trim(),
      timezone,
      shippingMode,
      flatRupees,
      freeOverRupees,
      gstPercent,
      gstin,
    })
  }

  useUnsavedChangesGuard({
    isDirty,
    enabled: canManage,
    onSaveAsDraft: async () => {
      if (!canManage || !isDirty || saveMutation.isPending) return
      const parsed = parseForm()
      if (!parsed.success) return
      await saveMutation.mutateAsync(buildPayload(parsed.data))
    },
  })

  const timezoneOptions = useMemo(() => {
    if (!timezone || TIMEZONES.some((item) => item.value === timezone)) {
      return TIMEZONES
    }
    return [{ value: timezone, label: timezone }, ...TIMEZONES]
  }, [timezone])

  function discard() {
    if (!settings) return
    applySettings(settings, {
      setName,
      setDomain,
      setContactEmail,
      setTimezone,
      setShippingMode,
      setFlatRupees,
      setFreeOverRupees,
      setGstPercent,
      setGstin,
    })
    setError(null)
    setFieldErrors({})
    setSaved(false)
  }

  async function copySlug() {
    if (!settings?.slug) return
    try {
      await navigator.clipboard.writeText(settings.slug)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canManage) return
    setSaved(false)
    const parsed = parseForm()
    if (!parsed.success) {
      const next: typeof fieldErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (
          key === "name" ||
          key === "domain" ||
          key === "contactEmail" ||
          key === "timezone" ||
          key === "shippingMode" ||
          key === "flatRupees" ||
          key === "freeOverRupees" ||
          key === "gstPercent" ||
          key === "gstin"
        ) {
          next[key] = issue.message
        }
      }
      setFieldErrors(next)
      return
    }
    setFieldErrors({})
    setError(null)
    saveMutation.mutate(buildPayload(parsed.data))
  }

  const fieldsDisabled = !canManage || saveMutation.isPending

  function renderStorePanel(section: string) {
    if (settingsQuery.isLoading) {
      return <Skeleton className="h-56 w-full" />
    }

    if (settingsQuery.isError) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Unable to load store settings</CardTitle>
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
              Integrations managed on their own pages
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-(--card-spacing)">
            <Link
              href="/admin/keys"
              className="group flex items-center gap-3 rounded-xl border border-border/70 bg-muted/20 px-3.5 py-3.5 transition-colors hover:border-border hover:bg-muted/45"
            >
              <span className="admin-kpi-icon">
                <KeyRound className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">API keys</p>
                <p className="text-sm text-muted-foreground">
                  Publishable and secret keys for storefront and server access
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          </CardContent>
        </Card>
      )
    }

    if (!FORM_SECTIONS.has(section)) return null

    return (
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {section === "general" ? (
          <Card>
            <CardHeader className="border-b">
              <CardTitle>General</CardTitle>
              <CardDescription>
                Public name and identifiers for this store
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-(--card-spacing)">
              <FieldGroup className="gap-5">
                <Field data-invalid={fieldErrors.name ? true : undefined}>
                  <FieldLabel htmlFor="name">Store name</FieldLabel>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={fieldsDisabled}
                    placeholder="Alora Fashion"
                    aria-invalid={fieldErrors.name ? true : undefined}
                  />
                  <FieldDescription>
                    Shown to customers on the storefront and in order emails
                  </FieldDescription>
                  {fieldErrors.name ? (
                    <FieldError>{fieldErrors.name}</FieldError>
                  ) : null}
                </Field>
                <Field>
                  <FieldLabel htmlFor="slug">Slug</FieldLabel>
                  <div className="flex gap-2">
                    <Input
                      id="slug"
                      value={settings?.slug ?? ""}
                      disabled
                      readOnly
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => void copySlug()}
                      aria-label="Copy slug"
                    >
                      {copied ? <Check /> : <Copy />}
                    </Button>
                  </div>
                  <FieldDescription>
                    URL identifier assigned at store creation. Ask a platform
                    admin to change it.
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel>Store status</FieldLabel>
                  <p className="text-sm">
                    {settings?.status === "ACTIVE"
                      ? "This store can sell. Status is managed by the platform."
                      : "This store is inactive. Status is managed by the platform."}
                  </p>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        ) : null}

        {section === "storefront" ? (
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Storefront</CardTitle>
              <CardDescription>
                Domain and contact details exposed to customers
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-(--card-spacing)">
              <FieldGroup className="gap-5">
                <Field data-invalid={fieldErrors.domain ? true : undefined}>
                  <FieldLabel htmlFor="domain">Domain</FieldLabel>
                  <Input
                    id="domain"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    disabled={fieldsDisabled}
                    placeholder="shop.example.com"
                    aria-invalid={fieldErrors.domain ? true : undefined}
                  />
                  <FieldDescription>
                    Public hostname for this store. Leave blank to use the slug
                    only. DNS verification is not required yet.
                  </FieldDescription>
                  {fieldErrors.domain ? (
                    <FieldError>{fieldErrors.domain}</FieldError>
                  ) : null}
                </Field>
                <Field
                  data-invalid={fieldErrors.contactEmail ? true : undefined}
                >
                  <FieldLabel htmlFor="contact-email">Contact email</FieldLabel>
                  <Input
                    id="contact-email"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    disabled={fieldsDisabled}
                    placeholder="hello@example.com"
                    aria-invalid={fieldErrors.contactEmail ? true : undefined}
                  />
                  <FieldDescription>
                    Customer-facing address for support and order questions
                  </FieldDescription>
                  {fieldErrors.contactEmail ? (
                    <FieldError>{fieldErrors.contactEmail}</FieldError>
                  ) : null}
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        ) : null}

        {section === "regional" ? (
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Regional</CardTitle>
              <CardDescription>
                Currency is fixed to INR. Timezone controls dates shown in this
                admin.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-(--card-spacing)">
              <FieldGroup className="gap-5">
                <Field>
                  <FieldLabel htmlFor="currency">Currency</FieldLabel>
                  <Input id="currency" value="INR" disabled readOnly />
                  <FieldDescription>
                    All prices and orders use INR, stored as integer paise
                  </FieldDescription>
                </Field>
                <Field data-invalid={fieldErrors.timezone ? true : undefined}>
                  <FieldLabel htmlFor="timezone">Timezone</FieldLabel>
                  <select
                    id="timezone"
                    className={selectClassName}
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    disabled={fieldsDisabled}
                  >
                    {timezoneOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.timezone ? (
                    <FieldError>{fieldErrors.timezone}</FieldError>
                  ) : null}
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        ) : null}

        {section === "shipping" ? (
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Shipping</CardTitle>
              <CardDescription>
                Checkout shipping rules for this store (amounts in rupees)
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-(--card-spacing)">
              <FieldGroup className="gap-5">
                <Field
                  data-invalid={fieldErrors.shippingMode ? true : undefined}
                >
                  <FieldLabel htmlFor="shipping-mode">Mode</FieldLabel>
                  <select
                    id="shipping-mode"
                    className={selectClassName}
                    value={shippingMode}
                    onChange={(e) =>
                      setShippingMode(e.target.value as ShippingMode)
                    }
                    disabled={fieldsDisabled}
                  >
                    {SHIPPING_MODE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.shippingMode ? (
                    <FieldError>{fieldErrors.shippingMode}</FieldError>
                  ) : null}
                </Field>
                {shippingMode !== "off" ? (
                  <Field
                    data-invalid={fieldErrors.flatRupees ? true : undefined}
                  >
                    <FieldLabel htmlFor="flat-rupees">
                      Flat shipping (₹)
                    </FieldLabel>
                    <Input
                      id="flat-rupees"
                      type="number"
                      min={0}
                      step="0.01"
                      value={flatRupees}
                      onChange={(e) => setFlatRupees(e.target.value)}
                      disabled={fieldsDisabled}
                      placeholder="200"
                      aria-invalid={fieldErrors.flatRupees ? true : undefined}
                    />
                    <FieldDescription>
                      Charged when shipping applies. Stored as paise on save.
                    </FieldDescription>
                    {fieldErrors.flatRupees ? (
                      <FieldError>{fieldErrors.flatRupees}</FieldError>
                    ) : null}
                  </Field>
                ) : null}
                {shippingMode === "free_over" ? (
                  <Field
                    data-invalid={
                      fieldErrors.freeOverRupees ? true : undefined
                    }
                  >
                    <FieldLabel htmlFor="free-over-rupees">
                      Free over (₹)
                    </FieldLabel>
                    <Input
                      id="free-over-rupees"
                      type="number"
                      min={0}
                      step="0.01"
                      value={freeOverRupees}
                      onChange={(e) => setFreeOverRupees(e.target.value)}
                      disabled={fieldsDisabled}
                      placeholder="500"
                      aria-invalid={
                        fieldErrors.freeOverRupees ? true : undefined
                      }
                    />
                    <FieldDescription>
                      Orders at or above this merchandise total ship free
                    </FieldDescription>
                    {fieldErrors.freeOverRupees ? (
                      <FieldError>{fieldErrors.freeOverRupees}</FieldError>
                    ) : null}
                  </Field>
                ) : null}
              </FieldGroup>
            </CardContent>
          </Card>
        ) : null}

        {section === "tax" ? (
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Tax</CardTitle>
              <CardDescription>
                GST applied at checkout on discounted merchandise
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-(--card-spacing)">
              <FieldGroup className="gap-5">
                <Field data-invalid={fieldErrors.gstPercent ? true : undefined}>
                  <FieldLabel htmlFor="gst-percent">GST percent</FieldLabel>
                  <Input
                    id="gst-percent"
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={gstPercent}
                    onChange={(e) => setGstPercent(e.target.value)}
                    disabled={fieldsDisabled}
                    placeholder="3"
                    aria-invalid={fieldErrors.gstPercent ? true : undefined}
                  />
                  {fieldErrors.gstPercent ? (
                    <FieldError>{fieldErrors.gstPercent}</FieldError>
                  ) : null}
                </Field>
                <Field data-invalid={fieldErrors.gstin ? true : undefined}>
                  <FieldLabel htmlFor="gstin">GSTIN</FieldLabel>
                  <Input
                    id="gstin"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    disabled={fieldsDisabled}
                    placeholder="22AAAAA0000A1Z5"
                    aria-invalid={fieldErrors.gstin ? true : undefined}
                  />
                  <FieldDescription>
                    Shown on invoices and packing slips when set
                  </FieldDescription>
                  {fieldErrors.gstin ? (
                    <FieldError>{fieldErrors.gstin}</FieldError>
                  ) : null}
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
        description="Your account, store identity, and storefront configuration"
        breadcrumbs={[{ label: "Settings" }]}
        actions={
          settings ? (
            <Badge
              variant={settings.status === "ACTIVE" ? "default" : "secondary"}
            >
              {settings.status}
            </Badge>
          ) : null
        }
      />

      <SettingsSectionLayout
        sections={STORE_SETTINGS_SECTIONS}
        defaultSection="profile"
      >
        {(section) =>
          section === "profile" ? (
            <SettingsProfileCard
              user={user}
              isLoading={permissionsLoading}
              scopeLabel={
                settings
                  ? `${settings.name} (${settings.slug})`
                  : "This store"
              }
              scopeDescription="You can only manage data for this store. Scope comes from your login, not a client store ID."
            />
          ) : (
            renderStorePanel(section)
          )
        }
      </SettingsSectionLayout>
    </div>
  )
}
