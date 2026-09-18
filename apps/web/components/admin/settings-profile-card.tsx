"use client"

import { useEffect, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { z } from "zod"

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
import { changePassword, type AuthUser } from "@/lib/auth"

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "New password must be different",
    path: ["newPassword"],
  })

function roleLabel(role: AuthUser["role"]) {
  return role === "PLATFORM_SUPER_ADMIN"
    ? "Platform Super Admin"
    : "Store Admin"
}

type SettingsProfileCardProps = {
  user: AuthUser | undefined
  isLoading?: boolean
  scopeLabel: string
  scopeDescription?: string
}

export function SettingsProfileCard({
  user,
  isLoading,
  scopeLabel,
  scopeDescription,
}: SettingsProfileCardProps) {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{
    currentPassword?: string
    newPassword?: string
    confirmPassword?: string
  }>({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!saved) return
    const timer = window.setTimeout(() => setSaved(false), 3000)
    return () => window.clearTimeout(timer)
  }, [saved])

  const mutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      setSaved(true)
      setError(null)
      setFieldErrors({})
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    },
    onError: (cause) => {
      setSaved(false)
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Failed to change password."
      )
    },
  })

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSaved(false)
    const parsed = passwordSchema.safeParse({
      currentPassword,
      newPassword,
      confirmPassword,
    })
    if (!parsed.success) {
      const next: typeof fieldErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (
          key === "currentPassword" ||
          key === "newPassword" ||
          key === "confirmPassword"
        ) {
          next[key] = issue.message
        }
      }
      setFieldErrors(next)
      return
    }
    setFieldErrors({})
    setError(null)
    mutation.mutate({
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
    })
  }

  if (isLoading) {
    return <Skeleton className="h-72 w-full" />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>
          Your signed-in account for this console
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-8">
        <FieldGroup className="gap-5">
          <Field>
            <FieldLabel htmlFor="profile-email">Email</FieldLabel>
            <Input
              id="profile-email"
              value={user?.email ?? ""}
              disabled
              readOnly
            />
            <FieldDescription>Sign-in address for this account</FieldDescription>
          </Field>
          <Field>
            <FieldLabel>Role</FieldLabel>
            <p className="text-sm">
              {user ? roleLabel(user.role) : "—"}
            </p>
          </Field>
          <Field>
            <FieldLabel>Access scope</FieldLabel>
            <p className="text-sm">{scopeLabel}</p>
            {scopeDescription ? (
              <FieldDescription>{scopeDescription}</FieldDescription>
            ) : null}
          </Field>
        </FieldGroup>

        <form onSubmit={onSubmit} className="flex flex-col gap-5 border-t pt-6">
          <div>
            <p className="text-sm font-medium">Change password</p>
            <p className="text-sm text-muted-foreground">
              Requires your current password. Other sessions will need to sign
              in again.
            </p>
          </div>
          <FieldGroup className="gap-5">
            <Field
              data-invalid={fieldErrors.currentPassword ? true : undefined}
            >
              <FieldLabel htmlFor="current-password">Current password</FieldLabel>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={mutation.isPending}
                aria-invalid={fieldErrors.currentPassword ? true : undefined}
              />
              {fieldErrors.currentPassword ? (
                <FieldError>{fieldErrors.currentPassword}</FieldError>
              ) : null}
            </Field>
            <Field data-invalid={fieldErrors.newPassword ? true : undefined}>
              <FieldLabel htmlFor="new-password">New password</FieldLabel>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={mutation.isPending}
                aria-invalid={fieldErrors.newPassword ? true : undefined}
              />
              <FieldDescription>At least 8 characters</FieldDescription>
              {fieldErrors.newPassword ? (
                <FieldError>{fieldErrors.newPassword}</FieldError>
              ) : null}
            </Field>
            <Field
              data-invalid={fieldErrors.confirmPassword ? true : undefined}
            >
              <FieldLabel htmlFor="confirm-password">
                Confirm new password
              </FieldLabel>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={mutation.isPending}
                aria-invalid={fieldErrors.confirmPassword ? true : undefined}
              />
              {fieldErrors.confirmPassword ? (
                <FieldError>{fieldErrors.confirmPassword}</FieldError>
              ) : null}
            </Field>
          </FieldGroup>

          {error ? <FieldError>{error}</FieldError> : null}
          {saved ? (
            <p className="text-sm text-muted-foreground">Password updated.</p>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Updating..." : "Update password"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
