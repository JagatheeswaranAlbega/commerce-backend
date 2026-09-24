"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, Package, ShoppingBag, Users, Warehouse } from "lucide-react"

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
import { getAdminDashboard } from "@/lib/api/admin/dashboard"
import { formatPaise } from "@/lib/money"

export function StoreDashboard() {
  const dashboardQuery = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: getAdminDashboard,
  })

  const data = dashboardQuery.data
  const cards = [
    {
      title: "Products",
      value: data?.products ?? "—",
      href: "/admin/products",
      icon: Package,
      description: "Catalog items",
    },
    {
      title: "Orders",
      value: data?.orders ?? "—",
      href: "/admin/orders",
      icon: ShoppingBag,
      description:
        data?.salesPaise != null
          ? `Sales ${formatPaise(data.salesPaise)}`
          : "Customer checkouts",
    },
    {
      title: "Inventory",
      value: data?.inventoryItems ?? "—",
      href: "/admin/inventory",
      icon: Warehouse,
      description:
        data?.lowStockCount != null
          ? `${data.lowStockCount} low stock`
          : "Tracked variants",
    },
    {
      title: "Customers",
      value: data?.customers ?? "—",
      href: "/admin/customers",
      icon: Users,
      description: "Store customers",
    },
  ]

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <AdminPageHeader
        title="Dashboard"
        description="Store operations overview and shortcuts"
        breadcrumbs={[{ label: "Dashboard" }]}
      />

      {dashboardQuery.isError ? (
        <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {dashboardQuery.error instanceof Error
            ? dashboardQuery.error.message
            : "Failed to load dashboard."}
        </p>
      ) : null}

      {(data?.pendingOrdersCount ?? 0) > 0 ||
      (data?.openReturnsCount ?? 0) > 0 ||
      (data?.lowStockCount ?? 0) > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {(data?.pendingOrdersCount ?? 0) > 0 ? (
            <Card className="border-sky-500/25 bg-sky-500/5 shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Pending orders</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  {data?.pendingOrdersCount}
                </p>
                <Link
                  href="/admin/orders"
                  className="text-sm font-medium underline-offset-4 hover:underline"
                >
                  Review orders
                </Link>
              </CardContent>
            </Card>
          ) : null}
          {(data?.openReturnsCount ?? 0) > 0 ? (
            <Card className="border-violet-500/25 bg-violet-500/5 shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Open returns</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  {data?.openReturnsCount}
                </p>
                <Link
                  href="/admin/orders?status=REFUNDED"
                  className="text-sm font-medium underline-offset-4 hover:underline"
                >
                  Review returns
                </Link>
              </CardContent>
            </Card>
          ) : null}
          {(data?.lowStockCount ?? 0) > 0 ? (
            <Card className="border-amber-500/25 bg-amber-500/5 shadow-none">
              <CardHeader className="flex flex-row items-center gap-2.5 space-y-0 pb-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="size-4" />
                </span>
                <CardTitle className="text-sm font-medium">Low stock</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {data?.lowStockCount} variants at or below 5 units.{" "}
                  <Link
                    href="/admin/inventory"
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    Review inventory
                  </Link>
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
          >
            <Card className="h-full transition-[background-color,box-shadow] group-hover:bg-muted/30 group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-ring/35">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <span className="admin-kpi-icon transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                  <card.icon className="size-4" />
                </span>
              </CardHeader>
              <CardContent className="space-y-1">
                {dashboardQuery.isLoading ? (
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
          <CardTitle className="text-sm font-medium">Quick links</CardTitle>
          <CardDescription>Common store operations</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 pt-4">
          <Link href="/admin/products">
            <Badge
              variant="secondary"
              className="h-7 cursor-pointer px-2.5 transition-colors hover:bg-muted"
            >
              Products
            </Badge>
          </Link>
          <Link href="/admin/inventory">
            <Badge
              variant="secondary"
              className="h-7 cursor-pointer px-2.5 transition-colors hover:bg-muted"
            >
              Inventory
            </Badge>
          </Link>
          <Link href="/admin/orders">
            <Badge
              variant="secondary"
              className="h-7 cursor-pointer px-2.5 transition-colors hover:bg-muted"
            >
              Orders
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
          <Link href="/admin/settings">
            <Badge
              variant="secondary"
              className="h-7 cursor-pointer px-2.5 transition-colors hover:bg-muted"
            >
              Settings
            </Badge>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
