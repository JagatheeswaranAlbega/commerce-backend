"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { DataTableSkeleton } from "@/components/admin/data-table-skeleton"
import { AdminPageHeader } from "@/components/admin/page-header"
import { DataTable, type AppColumnDef } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ApiError } from "@/lib/api"
import {
  fulfillAdminOrder,
  getAdminOrder,
  updateAdminOrder,
  type AdminOrder,
  type AdminOrderItem,
  type OrderStatus,
} from "@/lib/api/admin/orders"
import { getAdminSettings } from "@/lib/api/admin/settings"
import { formatDate } from "@/lib/format"
import { formatPaise } from "@/lib/money"

const fulfillSchema = z.object({
  trackingNumber: z.string().trim().min(1).optional().or(z.literal("")),
  carrier: z.string().trim().min(1).optional().or(z.literal("")),
})

const textareaClassName =
  "border-input bg-background min-h-24 w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none transition-[color,box-shadow,background-color,border-color] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-50"

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function openPrintableDocument(title: string, bodyHtml: string) {
  const win = window.open("", "_blank", "noopener,noreferrer,width=800,height=900")
  if (!win) return
  win.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 32px; color: #111; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    h2 { font-size: 14px; margin: 24px 0 8px; }
    p, td, th, li { font-size: 12px; line-height: 1.45; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border-bottom: 1px solid #ddd; padding: 8px 6px; text-align: left; }
    th { font-weight: 600; }
    .muted { color: #555; }
    .totals { margin-top: 16px; max-width: 280px; margin-left: auto; }
    .totals div { display: flex; justify-content: space-between; gap: 24px; padding: 4px 0; }
    .totals .grand { font-weight: 600; border-top: 1px solid #ddd; margin-top: 6px; padding-top: 8px; }
    @media print { body { margin: 12px; } }
  </style>
</head>
<body>
${bodyHtml}
<script>window.onload = function () { window.focus(); window.print(); };</script>
</body>
</html>`)
  win.document.close()
}

function buildOrderPrintHtml(
  order: AdminOrder,
  kind: "packing" | "invoice",
  settings: { gstin: string | null; gstPercent: number; storeName?: string }
) {
  const address = [
    order.shippingName,
    order.shippingPhone,
    [order.shippingAddressLine1, order.shippingAddressLine2]
      .filter(Boolean)
      .join(", "),
    [order.shippingCity, order.shippingState, order.shippingPostalCode]
      .filter(Boolean)
      .join(", "),
    order.shippingCountry,
  ]
    .filter(Boolean)
    .map((line) => `<div>${escapeHtml(String(line))}</div>`)
    .join("")

  const rows = (order.items ?? [])
    .map(
      (item) => `<tr>
      <td>${escapeHtml(item.productTitle)}<div class="muted">${escapeHtml(item.variantTitle)} · ${escapeHtml(item.sku)}</div></td>
      <td>${item.quantity}</td>
      <td>${escapeHtml(formatPaise(item.unitPricePaise))}</td>
      <td>${escapeHtml(formatPaise(item.lineTotalPaise))}</td>
    </tr>`
    )
    .join("")

  const gstLabel =
    settings.gstPercent > 0 ? `GST (${settings.gstPercent}%)` : "GST"

  const heading = kind === "packing" ? "Packing slip" : "Invoice"
  const storeLine = settings.storeName
    ? `<p class="muted">${escapeHtml(settings.storeName)}</p>`
    : ""
  const emailLine = order.email
    ? `<p>Email: ${escapeHtml(order.email)}</p>`
    : ""
  const gstinLine = settings.gstin
    ? `<p>GSTIN: ${escapeHtml(settings.gstin)}</p>`
    : ""

  return `
    <h1>${escapeHtml(heading)}</h1>
    ${storeLine}
    <p><strong>${escapeHtml(order.orderNumber)}</strong> · ${escapeHtml(order.status)} · ${escapeHtml(formatDate(order.createdAt))}</p>
    ${emailLine}
    ${gstinLine}
    <h2>Ship to</h2>
    ${address || "<p class='muted'>No shipping address</p>"}
    <h2>Line items</h2>
    <table>
      <thead>
        <tr><th>Product</th><th>Qty</th><th>Unit</th><th>Line</th></tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="4">No line items</td></tr>`}
      </tbody>
    </table>
    <div class="totals">
      <div><span>Subtotal</span><span>${escapeHtml(formatPaise(order.subtotalPaise ?? 0))}</span></div>
      <div><span>Discount${order.discountCode ? ` (${escapeHtml(order.discountCode)})` : ""}</span><span>${escapeHtml(formatPaise(order.discountTotalPaise ?? 0))}</span></div>
      <div><span>${escapeHtml(gstLabel)}</span><span>${escapeHtml(formatPaise(order.taxTotalPaise ?? 0))}</span></div>
      <div><span>Shipping</span><span>${escapeHtml(formatPaise(order.shippingTotalPaise ?? 0))}</span></div>
      <div class="grand"><span>Grand total</span><span>${escapeHtml(formatPaise(order.grandTotalPaise))}</span></div>
    </div>
  `
}

export function StoreOrderDetail() {
  const params = useParams<{ id: string }>()
  const orderId = params.id
  const queryClient = useQueryClient()
  const [trackingNumber, setTrackingNumber] = useState("")
  const [carrier, setCarrier] = useState("")
  const [adminNote, setAdminNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [noteError, setNoteError] = useState<string | null>(null)
  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null)

  const orderQuery = useQuery({
    queryKey: ["admin", "orders", orderId],
    queryFn: () => getAdminOrder(orderId),
    enabled: Boolean(orderId),
  })

  const settingsQuery = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: getAdminSettings,
  })

  useEffect(() => {
    if (!orderQuery.data) return
    setTrackingNumber(orderQuery.data.trackingNumber ?? "")
    setCarrier(orderQuery.data.carrier ?? "")
    setAdminNote(orderQuery.data.adminNote ?? "")
  }, [orderQuery.data])

  const statusMutation = useMutation({
    mutationFn: (status: OrderStatus) => updateAdminOrder(orderId, { status }),
    onSuccess: async () => {
      setPendingStatus(null)
      await queryClient.invalidateQueries({ queryKey: ["admin", "orders"] })
    },
  })

  const noteMutation = useMutation({
    mutationFn: (nextNote: string) =>
      updateAdminOrder(orderId, { adminNote: nextNote || null }),
    onSuccess: async () => {
      setNoteError(null)
      await queryClient.invalidateQueries({ queryKey: ["admin", "orders"] })
    },
    onError: (cause) => {
      setNoteError(
        cause instanceof ApiError ? cause.message : "Failed to save note."
      )
    },
  })

  const fulfillMutation = useMutation({
    mutationFn: () =>
      fulfillAdminOrder(orderId, {
        trackingNumber: trackingNumber.trim() || undefined,
        carrier: carrier.trim() || undefined,
        status: "SHIPPED",
      }),
    onSuccess: async () => {
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ["admin", "orders"] })
    },
    onError: (cause) => {
      setError(
        cause instanceof ApiError ? cause.message : "Failed to fulfill order."
      )
    },
  })

  const columns = useMemo<AppColumnDef<AdminOrderItem>[]>(
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

  const order = orderQuery.data
  const settings = settingsQuery.data
  const gstPercent = settings?.tax.gstPercent
  const gstLabel =
    typeof gstPercent === "number" && gstPercent > 0
      ? `GST (${gstPercent}%)`
      : "GST"
  const nextStatus: OrderStatus | null =
    order?.status === "PENDING"
      ? "CONFIRMED"
      : order?.status === "CONFIRMED"
        ? "PROCESSING"
        : order?.status === "PROCESSING"
          ? "SHIPPED"
          : order?.status === "SHIPPED"
            ? "DELIVERED"
            : null

  function onFulfill(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const parsed = fulfillSchema.safeParse({ trackingNumber, carrier })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid fulfillment")
      return
    }
    fulfillMutation.mutate()
  }

  function printDocument(kind: "packing" | "invoice") {
    if (!order) return
    openPrintableDocument(
      `${kind === "packing" ? "Packing slip" : "Invoice"} ${order.orderNumber}`,
      buildOrderPrintHtml(order, kind, {
        gstin: settings?.tax.gstin ?? null,
        gstPercent: settings?.tax.gstPercent ?? 0,
        storeName: settings?.name,
      })
    )
  }

  if (orderQuery.isLoading) {
    return <DataTableSkeleton columns={4} rows={5} />
  }

  if (orderQuery.isError || !order) {
    return (
      <div className="flex flex-col gap-4">
        <AdminPageHeader
          title="Order"
          breadcrumbs={[
            { label: "Orders", href: "/admin/orders" },
            { label: "Not found" },
          ]}
        />
        <p className="text-sm text-destructive">
          {orderQuery.error instanceof Error
            ? orderQuery.error.message
            : "Order not found."}
        </p>
      </div>
    )
  }

  const noteDirty = adminNote !== (order.adminNote ?? "")

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        title={order.orderNumber}
        description={`${order.status === "REFUNDED" ? "returned (restocked)" : order.status} · ${formatDate(order.createdAt)}`}
        breadcrumbs={[
          { label: "Orders", href: "/admin/orders" },
          { label: order.orderNumber },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => printDocument("packing")}
            >
              Packing slip
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => printDocument("invoice")}
            >
              Invoice
            </Button>
            {nextStatus ? (
              <Button
                type="button"
                variant="outline"
                disabled={statusMutation.isPending}
                onClick={() => setPendingStatus(nextStatus)}
              >
                Mark {nextStatus.toLowerCase()}
              </Button>
            ) : null}
            {order.status !== "CANCELLED" && order.status !== "REFUNDED" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={statusMutation.isPending}
                  onClick={() => setPendingStatus("CANCELLED")}
                >
                  Cancel order
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={statusMutation.isPending}
                  onClick={() => setPendingStatus("REFUNDED")}
                >
                  Mark returned (restock)
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      <ConfirmDialog
        open={Boolean(pendingStatus)}
        onOpenChange={(open) => {
          if (!open) setPendingStatus(null)
        }}
        title="Update order status?"
        description={
          pendingStatus === "REFUNDED"
            ? `Mark order ${order.orderNumber} as returned and restore stock? No payment is refunded.`
            : pendingStatus
              ? `Mark order ${order.orderNumber} as ${pendingStatus}?`
              : ""
        }
        confirmLabel={
          pendingStatus === "REFUNDED"
            ? "Mark returned (restock)"
            : `Mark ${pendingStatus?.toLowerCase() ?? "updated"}`
        }
        destructive={
          pendingStatus === "CANCELLED" || pendingStatus === "REFUNDED"
        }
        pending={statusMutation.isPending}
        onConfirm={() => {
          if (pendingStatus) statusMutation.mutate(pendingStatus)
        }}
      />

      {(order.returns?.length ?? 0) > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">Returns</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {order.returns?.map((ret) => (
              <li
                key={ret.id}
                className="rounded-lg border border-border/80 px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{ret.status}</Badge>
                  <Link
                    href="/admin/returns"
                    className="underline-offset-4 hover:underline"
                  >
                    View in Returns
                  </Link>
                  <span className="text-muted-foreground">
                    {formatDate(ret.createdAt)}
                  </span>
                </div>
                <p className="mt-1 text-muted-foreground">{ret.reason}</p>
                {ret.decisionNote ? (
                  <p className="mt-1 text-muted-foreground">
                    Note: {ret.decisionNote}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
            <dt className="text-muted-foreground">{gstLabel}</dt>
            <dd>{formatPaise(order.taxTotalPaise ?? 0)}</dd>
            <dt className="text-muted-foreground">Shipping</dt>
            <dd>{formatPaise(order.shippingTotalPaise ?? 0)}</dd>
            <dt className="font-medium">Grand total</dt>
            <dd className="font-medium">{formatPaise(order.grandTotalPaise)}</dd>
          </dl>
          {settings?.tax.gstin ? (
            <p className="text-sm text-muted-foreground">
              GSTIN: {settings.tax.gstin}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">Shipping</h2>
          {order.email ? (
            <p className="text-sm text-muted-foreground">{order.email}</p>
          ) : null}
          <p className="text-sm">{order.shippingName}</p>
          {order.shippingPhone ? (
            <p className="text-sm text-muted-foreground">{order.shippingPhone}</p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {[order.shippingAddressLine1, order.shippingAddressLine2]
              .filter(Boolean)
              .join(", ")}
          </p>
          <p className="text-sm text-muted-foreground">
            {[order.shippingCity, order.shippingState, order.shippingPostalCode]
              .filter(Boolean)
              .join(", ")}
          </p>
          <p className="text-sm text-muted-foreground">{order.shippingCountry}</p>
        </div>
      </section>

      <section className="flex max-w-lg flex-col gap-4">
        <h2 className="text-lg font-medium">Admin note</h2>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="admin-note">Internal note</FieldLabel>
            <textarea
              id="admin-note"
              className={textareaClassName}
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              disabled={noteMutation.isPending}
              placeholder="Fulfillment notes, customer context…"
            />
            {noteError ? <FieldError>{noteError}</FieldError> : null}
          </Field>
        </FieldGroup>
        <div>
          <Button
            type="button"
            disabled={!noteDirty || noteMutation.isPending}
            onClick={() => noteMutation.mutate(adminNote.trim())}
          >
            {noteMutation.isPending ? "Saving..." : "Save note"}
          </Button>
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

      <section className="flex max-w-lg flex-col gap-4">
        <h2 className="text-lg font-medium">Fulfillment</h2>
        {order.status === "CANCELLED" || order.status === "REFUNDED" ? (
          <p className="text-sm text-muted-foreground">
            This order is{" "}
            {order.status === "REFUNDED" ? "returned (restocked)" : "cancelled"}{" "}
            and cannot be fulfilled.
          </p>
        ) : (
          <form onSubmit={onFulfill} className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="carrier">Carrier</FieldLabel>
                <Input
                  id="carrier"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  disabled={fulfillMutation.isPending}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="tracking">Tracking number</FieldLabel>
                <Input
                  id="tracking"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  disabled={fulfillMutation.isPending}
                />
              </Field>
            </FieldGroup>
            {error ? <FieldError>{error}</FieldError> : null}
            <Button type="submit" disabled={fulfillMutation.isPending}>
              {fulfillMutation.isPending ? "Saving..." : "Mark shipped"}
            </Button>
          </form>
        )}
      </section>
    </div>
  )
}
