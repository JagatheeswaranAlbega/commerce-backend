import Link from "next/link"

import { LoginForm } from "@/components/login-form"

export default function LoginPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="text-center">
          <p className="text-sm font-medium">Commerce Console</p>
          <p className="text-xs text-muted-foreground">
            Sign in with your admin account
          </p>
        </div>
        <LoginForm />
        <p className="text-center text-xs text-muted-foreground">
          Looking for the boutique?{" "}
          <Link href="/shop" className="underline underline-offset-4 hover:text-foreground">
            Visit the shop
          </Link>
        </p>
      </div>
    </div>
  )
}
