"use client"

import { usePathname, useRouter } from "next/navigation"
import { Boxes, LogOut, Shield } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useMemo } from "react"

import {
  GuardedLink,
  NavigationGuardProvider,
} from "@/components/admin/navigation-guard"
import { ADMIN_NAV_GROUPS, ADMIN_NAV_ITEMS } from "@/components/admin/nav"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ApiError } from "@/lib/api"
import { getAdminSettings } from "@/lib/api/admin/settings"
import { getPlatformSettings } from "@/lib/api/platform/settings"
import { getMe, logout } from "@/lib/auth"
import { setDefaultFormatTimeZone } from "@/lib/format"
import {
  hasPermission,
  permissionsForRole,
} from "@/lib/permissions"

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getMe,
    retry: false,
  })

  useEffect(() => {
    if (meQuery.error instanceof ApiError && meQuery.error.status === 401) {
      void logout().then(() => {
        router.replace("/login")
        router.refresh()
      })
    }
  }, [meQuery.error, router])

  const permissions = meQuery.data
    ? permissionsForRole(meQuery.data.role)
    : undefined

  const isPlatform = hasPermission(permissions, "platform.metrics")

  const settingsQuery = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: getAdminSettings,
    enabled: Boolean(meQuery.data) && !isPlatform && Boolean(meQuery.data?.storeId),
  })

  const platformSettingsQuery = useQuery({
    queryKey: ["platform", "settings"],
    queryFn: getPlatformSettings,
    enabled: Boolean(meQuery.data) && isPlatform,
  })

  useEffect(() => {
    if (isPlatform) {
      setDefaultFormatTimeZone(undefined)
      return
    }
    setDefaultFormatTimeZone(settingsQuery.data?.timezone)
    return () => setDefaultFormatTimeZone(undefined)
  }, [isPlatform, settingsQuery.data?.timezone])

  const { navGroups, footerItems } = useMemo(() => {
    const groups = ADMIN_NAV_GROUPS.map((group) => ({
      ...group,
      items: ADMIN_NAV_ITEMS.filter(
        (item) =>
          item.group === group.id &&
          hasPermission(permissions, item.permission)
      ),
    })).filter((group) => group.items.length > 0)

    // Keep Settings with logout so the main nav stays shorter / no scroll.
    const systemGroup = groups.find((group) => group.id === "system")
    const navGroups = groups.filter((group) => group.id !== "system")

    return {
      navGroups,
      footerItems: systemGroup?.items ?? [],
    }
  }, [permissions])

  async function onLogout() {
    await logout()
    router.push("/login")
    router.refresh()
  }

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin"
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const brandLabel = isPlatform
    ? (platformSettingsQuery.data?.platformName?.trim() || "Platform")
    : (settingsQuery.data?.name ?? "Store Admin")
  const headerSubtitle = isPlatform
    ? "Platform Super Admin"
    : (settingsQuery.data?.name ?? "Store management")
  const BrandIcon = isPlatform ? Shield : Boxes

  const headerLoading =
    meQuery.isLoading ||
    (isPlatform
      ? platformSettingsQuery.isLoading
      : settingsQuery.isLoading)

  return (
    <NavigationGuardProvider>
      <TooltipProvider>
        <SidebarProvider>
          <Sidebar variant="inset" collapsible="icon">
            <SidebarHeader className="gap-1 p-2">
              <div className="flex items-center gap-2.5 px-1.5 py-1.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
                  <BrandIcon className="size-4" />
                </div>
                <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                  <p className="truncate text-sm font-medium tracking-tight leading-snug">
                    {brandLabel}
                  </p>
                  <p className="truncate text-xs leading-snug text-sidebar-foreground/60">
                    {meQuery.data?.email ?? "Loading..."}
                  </p>
                </div>
              </div>
            </SidebarHeader>
            <SidebarContent className="gap-0 overflow-hidden">
              {navGroups.map((group, index) => (
                <SidebarGroup
                  key={group.id}
                  className={isPlatform ? "p-2" : "px-2 py-1"}
                >
                  {isPlatform ? (
                    <SidebarGroupLabel className="h-7 px-2 text-xs">
                      {group.label}
                    </SidebarGroupLabel>
                  ) : index > 0 ? (
                    <Separator className="mb-1.5 mx-2 bg-sidebar-border" />
                  ) : null}
                  <SidebarGroupContent>
                    <SidebarMenu className="gap-0.5">
                      {group.items.map((link) => (
                        <SidebarMenuItem key={link.href}>
                          <SidebarMenuButton
                            render={<GuardedLink href={link.href} />}
                            isActive={isActive(link.href)}
                            tooltip={link.label}
                          >
                            <link.icon />
                            <span>{link.label}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              ))}
            </SidebarContent>
            <SidebarFooter className="gap-0 p-2">
              <SidebarMenu className="gap-0.5">
                {footerItems.map((link) => (
                  <SidebarMenuItem key={link.href}>
                    <SidebarMenuButton
                      render={<GuardedLink href={link.href} />}
                      isActive={isActive(link.href)}
                      tooltip={link.label}
                    >
                      <link.icon />
                      <span>{link.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="Log out"
                    onClick={() => void onLogout()}
                  >
                    <LogOut />
                    <span>Log out</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarFooter>
          </Sidebar>
          <SidebarInset>
            <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-border/70 bg-background/85 px-4 backdrop-blur-md supports-backdrop-filter:bg-background/70">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <div className="min-w-0">
                {headerLoading ? (
                  <Skeleton className="h-4 w-36" />
                ) : (
                  <p className="truncate text-sm font-medium text-foreground/80">
                    {headerSubtitle}
                  </p>
                )}
              </div>
            </header>
            <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
              <div className="mx-auto w-full max-w-7xl">{children}</div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </NavigationGuardProvider>
  )
}
