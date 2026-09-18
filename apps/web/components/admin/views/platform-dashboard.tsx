"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Package, ShoppingBag, Store, UserCog } from "lucide-react"

import { AdminPageHeader } from "@/components/admin/page-header"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getPlatformMetrics } from "@/lib/api/platform/metrics"
import { formatPaise } from "@/lib/money"

export function PlatformDashboard() {
  const metricsQuery = useQuery({
    queryKey: ["platform", "metrics"],
    queryFn: getPlatformMetrics,
  })

  const metrics = metricsQuery.data
  const cards = [
    {
      title: "Stores",
      value: metrics?.storeCount ?? "—",
      href: "/admin/stores",
      icon: Store,
      description: "Merchant tenants",
    },
    {
      title: "Store admins",
      value: metrics?.adminCount ?? "—",
      href: "/admin/store-admins",
      icon: UserCog,
      description: "Provisioned accounts",
    },
    {
      title: "Products",
      value: metrics?.productCount ?? "—",
      href: "/admin/products",
      icon: Package,
      description: "Across all stores",
    },
    {
      title: "Orders",
      value: metrics?.orderCount ?? "—",
      href: "/admin/orders",
      icon: ShoppingBag,
      description:
        metrics?.salesPaise != null
          ? `Sales ${formatPaise(metrics.salesPaise)}`
          : "Platform-wide",
    },
  ]

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <AdminPageHeader
        title="Dashboard"
        description="Global platform metrics and shortcuts"
        breadcrumbs={[{ label: "Dashboard" }]}
      />

      {metricsQuery.isError ? (
        <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {metricsQuery.error instanceof Error
            ? metricsQuery.error.message
            : "Failed to load metrics."}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
          >
            <Card className="h-full transition-[background-color,box-shadow,border-color] group-hover:bg-muted/30 group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-ring/35">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <span className="admin-kpi-icon transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                  <card.icon className="size-4" />
                </span>
              </CardHeader>
              <CardContent className="space-y-1">
                {metricsQuery.isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-2xl font-semibold tracking-tight tabular-nums">
                    {card.value}
                  </div>
                )}
                <CardDescription>{card.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-sm font-medium">Shortcuts</CardTitle>
          <CardDescription>Jump into common platform tasks</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 pt-4">
          <Link href="/admin/stores/new">
            <Badge
              variant="secondary"
              className="h-7 cursor-pointer px-2.5 transition-colors hover:bg-muted"
            >
              Create store
            </Badge>
          </Link>
          <Link href="/admin/store-admins">
            <Badge
              variant="secondary"
              className="h-7 cursor-pointer px-2.5 transition-colors hover:bg-muted"
            >
              Manage admins
            </Badge>
          </Link>
          <Link href="/admin/keys">
            <Badge
              variant="secondary"
              className="h-7 cursor-pointer px-2.5 transition-colors hover:bg-muted"
            >
              API keys
            </Badge>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
