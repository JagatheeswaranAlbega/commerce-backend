"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff } from "lucide-react"
import { z } from "zod"
import { cn } from "cn"

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
import { homeForRole, login } from "@/lib/auth"

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
})

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string
    password?: string
  }>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setFieldErrors({})
    setIsSubmitting(true)

    const formData = new FormData(event.currentTarget)
    const parsed = loginSchema.safeParse({
      email: String(formData.get("email") ?? "").trim(),
      password: String(formData.get("password") ?? ""),
    })

    if (!parsed.success) {
      const next: { email?: string; password?: string } = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (key === "email" || key === "password") {
          next[key] = issue.message
        }
      }
      setFieldErrors(next)
      setIsSubmitting(false)
      return
    }

    try {
      const result = await login(parsed.data)
      router.push(homeForRole(result.user.role))
      router.refresh()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "An unexpected error occurred."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Platform and store admins use the same login
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit}>
            <FieldGroup>
              <Field data-invalid={fieldErrors.email ? true : undefined}>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="admin@alora.com"
                  autoComplete="email"
                  required
                  disabled={isSubmitting}
                />
                {fieldErrors.email ? (
                  <FieldError>{fieldErrors.email}</FieldError>
                ) : null}
              </Field>
              <Field data-invalid={fieldErrors.password ? true : undefined}>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    disabled={isSubmitting}
                    className="pr-9 [&::-ms-clear]:hidden [&::-ms-reveal]:hidden"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 z-10 flex w-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    aria-controls="password"
                    disabled={isSubmitting}
                  >
                    {showPassword ? (
                      <EyeOff className="pointer-events-none size-4" />
                    ) : (
                      <Eye className="pointer-events-none size-4" />
                    )}
                  </button>
                </div>
                {fieldErrors.password ? (
                  <FieldError>{fieldErrors.password}</FieldError>
                ) : null}
              </Field>
              {error ? (
                <Field data-invalid>
                  <FieldError>{error}</FieldError>
                </Field>
              ) : null}
              <Field>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Signing in..." : "Sign in"}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
