"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"

import { DataTable, type AppColumnDef } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { getPlatformOrder } from "@/lib/api/platform/orders"
import { formatDate } from "@/lib/format"
import { formatPaise } from "@/lib/money"

type LineItem = NonNullable<
  Awaited<ReturnType<typeof getPlatformOrder>>["items"]
>[number]

export function PlatformOrderDetail() {
  const params = useParams<{ id: string }>()
  const orderId = params.id

  const orderQuery = useQuery({
    queryKey: ["platform", "orders", orderId],
    queryFn: () => getPlatformOrder(orderId),
    enabled: Boolean(orderId),
  })

  const columns = useMemo<AppColumnDef<LineItem>[]>(
    () => [
      {
        accessorKey: "productTitle",
        header: "Product",
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.productTitle}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.variantTitle} · {row.original.sku}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "unitPricePaise",
        header: "Unit",
        cell: ({ row }) => formatPaise(row.original.unitPricePaise),
      },
      { accessorKey: "quantity", header: "Qty" },
      {
        accessorKey: "lineTotalPaise",
        header: "Line",
        cell: ({ row }) => formatPaise(row.original.lineTotalPaise),
      },
    ],
    []
  )

  if (orderQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>
  }

  if (orderQuery.isError || !orderQuery.data) {
    return (
      <div className="flex flex-col gap-4">
        <Link
          href="/admin/orders"
          className="text-sm underline-offset-4 hover:underline"
        >
          Back to orders
        </Link>
        <p className="text-sm text-destructive">
          {orderQuery.error instanceof Error
            ? orderQuery.error.message
            : "Order not found."}
        </p>
      </div>
    )
  }

  const order = orderQuery.data

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link
          href="/admin/orders"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Back to orders
        </Link>
        <h1 className="text-2xl font-medium">{order.orderNumber}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            {order.status === "REFUNDED"
              ? "Returned (restocked)"
              : order.status}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {formatDate(order.createdAt)}
          </span>
          <Link
            href={`/admin/stores/${order.storeId}`}
            className="text-sm underline-offset-4 hover:underline"
          >
            View store
          </Link>
        </div>
        {order.email ? (
          <p className="text-sm text-muted-foreground">{order.email}</p>
        ) : null}
      </div>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">Totals</h2>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd>{formatPaise(order.subtotalPaise ?? 0)}</dd>
            <dt className="text-muted-foreground">
              Discount{order.discountCode ? ` (${order.discountCode})` : ""}
            </dt>
            <dd>{formatPaise(order.discountTotalPaise ?? 0)}</dd>
            <dt className="text-muted-foreground">GST</dt>
            <dd>{formatPaise(order.taxTotalPaise ?? 0)}</dd>
            <dt className="text-muted-foreground">Shipping</dt>
            <dd>{formatPaise(order.shippingTotalPaise ?? 0)}</dd>
            <dt className="font-medium">Grand total</dt>
            <dd className="font-medium">{formatPaise(order.grandTotalPaise)}</dd>
          </dl>
          {(order.trackingNumber || order.carrier) && (
            <p className="text-sm text-muted-foreground">
              {[order.carrier, order.trackingNumber].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">Shipping</h2>
          <p className="text-sm">{order.shippingName}</p>
          <p className="text-sm text-muted-foreground">
            {order.shippingAddressLine1}
          </p>
          <p className="text-sm text-muted-foreground">
            {[order.shippingCity, order.shippingPostalCode, order.shippingCountry]
              .filter(Boolean)
              .join(", ")}
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Line items</h2>
        <DataTable
          columns={columns}
          data={order.items ?? []}
          emptyMessage="No line items."
        />
      </section>
    </div>
  )
}
