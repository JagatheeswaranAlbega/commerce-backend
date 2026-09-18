"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { CopyButton } from "@/components/copy-button"
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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { PermissionGate } from "@/components/admin/permission-gate"
import { ApiError } from "@/lib/api"
import {
  createPlatformStore,
  type CreateStoreResult,
} from "@/lib/api/platform/stores"
import { slugify } from "@/lib/format"

const createStoreSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase slug format"),
  adminEmail: z.string().email("Valid admin email required"),
  adminPassword: z.string().min(8, "At least 8 characters"),
})

export default function CreateStorePage() {
  return (
    <PermissionGate permission="stores.manage">
      <CreateStorePageContent />
    </PermissionGate>
  )
}

function CreateStorePageContent() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [adminEmail, setAdminEmail] = useState("")
  const [adminPassword, setAdminPassword] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [created, setCreated] = useState<CreateStoreResult | null>(null)

  const createMutation = useMutation({
    mutationFn: createPlatformStore,
    onSuccess: async (result) => {
      setCreated(result)
      await queryClient.invalidateQueries({ queryKey: ["platform", "stores"] })
      await queryClient.invalidateQueries({ queryKey: ["platform", "metrics"] })
    },
    onError: (cause) => {
      setError(cause instanceof ApiError ? cause.message : "Failed to create store.")
    },
  })

  function onNameChange(value: string) {
    setName(value)
    if (!slugTouched) {
      setSlug(slugify(value))
    }
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setFieldErrors({})

    const parsed = createStoreSchema.safeParse({
      name: name.trim(),
      slug: slug.trim() || slugify(name),
      adminEmail: adminEmail.trim(),
      adminPassword,
    })

    if (!parsed.success) {
      const next: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "")
        if (key) next[key] = issue.message
      }
      setFieldErrors(next)
      return
    }

    createMutation.mutate(parsed.data)
  }

  if (created) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-medium">Store created</h1>
          <p className="text-sm text-muted-foreground">
            Copy API keys now — raw secrets are only shown once
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{created.store.name}</CardTitle>
            <CardDescription>
              Admin {created.admin.email} · slug {created.store.slug}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <div className="rounded-md border bg-muted/40 p-3">
              <p className="font-medium">Publishable key</p>
              <div className="mt-1 flex items-start gap-2">
                <code className="min-w-0 flex-1 break-all text-xs">
                  {created.keys.publishableKey}
                </code>
                <CopyButton
                  value={created.keys.publishableKey}
                  label="Copy publishable key"
                />
              </div>
            </div>
            <div className="rounded-md border bg-muted/40 p-3">
              <p className="font-medium">Secret key</p>
              <div className="mt-1 flex items-start gap-2">
                <code className="min-w-0 flex-1 break-all text-xs">
                  {created.keys.secretKey}
                </code>
                <CopyButton
                  value={created.keys.secretKey}
                  label="Copy secret key"
                />
              </div>
            </div>
            <Button
              type="button"
              onClick={() => router.push(`/admin/stores/${created.store.id}`)}
            >
              Continue to store
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-medium">Create store</h1>
        <p className="text-sm text-muted-foreground">
          Onboard a merchant with an initial store admin and API keys
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Store + admin</CardTitle>
          <CardDescription>
            Publishable and secret keys are generated automatically
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <FieldGroup>
              <Field data-invalid={fieldErrors.name ? true : undefined}>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => onNameChange(e.target.value)}
                  placeholder="Terra Fashion"
                  disabled={createMutation.isPending}
                />
                {fieldErrors.name ? (
                  <FieldError>{fieldErrors.name}</FieldError>
                ) : null}
              </Field>
              <Field data-invalid={fieldErrors.slug ? true : undefined}>
                <FieldLabel htmlFor="slug">Slug</FieldLabel>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true)
                    setSlug(e.target.value)
                  }}
                  placeholder="terra-fashion"
                  disabled={createMutation.isPending}
                />
                {fieldErrors.slug ? (
                  <FieldError>{fieldErrors.slug}</FieldError>
                ) : null}
              </Field>
              <Field data-invalid={fieldErrors.adminEmail ? true : undefined}>
                <FieldLabel htmlFor="adminEmail">Admin email</FieldLabel>
                <Input
                  id="adminEmail"
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@store.local"
                  disabled={createMutation.isPending}
                />
                {fieldErrors.adminEmail ? (
                  <FieldError>{fieldErrors.adminEmail}</FieldError>
                ) : null}
              </Field>
              <Field data-invalid={fieldErrors.adminPassword ? true : undefined}>
                <FieldLabel htmlFor="adminPassword">Admin password</FieldLabel>
                <Input
                  id="adminPassword"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  minLength={8}
                  disabled={createMutation.isPending}
                />
                {fieldErrors.adminPassword ? (
                  <FieldError>{fieldErrors.adminPassword}</FieldError>
                ) : null}
              </Field>
            </FieldGroup>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                nativeButton={false}
                render={<Link href="/admin/stores" />}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create store"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
