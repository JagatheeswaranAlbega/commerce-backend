"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { AdminPageHeader } from "@/components/admin/page-header"
import { PermissionGate } from "@/components/admin/permission-gate"
import { RoleSwitch } from "@/components/admin/role-switch"
import {
  PlatformStoreFilter,
  usePlatformStoreFilter,
} from "@/components/admin/platform-store-filter"
import { DataTableSkeleton } from "@/components/admin/data-table-skeleton"
import { DataTable, type AppColumnDef } from "@/components/data-table"
import { ListPagination } from "@/components/list-pagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ADMIN_TABLE_PAGE_SIZE } from "@/lib/admin-table"
import {
  downloadAdminSalesCsv,
  getAdminSalesReport,
  type SalesReportDaily,
  type SalesReportOrder,
} from "@/lib/api/admin/reports"
import {
  downloadPlatformSalesCsv,
  getPlatformSalesReport,
} from "@/lib/api/platform/reports"
import { formatDateTime } from "@/lib/format"
import { formatPaise } from "@/lib/money"

function defaultFrom(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 29)
  return d.toISOString().slice(0, 10)
}

function defaultTo(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function AdminReportsPage() {
  return (
    <PermissionGate permission="dashboard.read">
      <RoleSwitch
        platform={<PlatformReportsPage />}
        store={<StoreReportsPage />}
      />
    </PermissionGate>
  )
}

function StoreReportsPage() {
  return <ReportsContent mode="store" />
}

function PlatformReportsPage() {
  const { storeId, setStoreId } = usePlatformStoreFilter()
  return (
    <ReportsContent
      mode="platform"
      storeId={storeId}
      onStoreIdChange={setStoreId}
    />
  )
}

function ReportsContent({
  mode,
  storeId = "",
  onStoreIdChange,
}: {
  mode: "store" | "platform"
  storeId?: string
  onStoreIdChange?: (id: string) => void
}) {
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)
  const [appliedFrom, setAppliedFrom] = useState(defaultFrom)
  const [appliedTo, setAppliedTo] = useState(defaultTo)
  const [page, setPage] = useState(1)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const enabled = mode === "store" || Boolean(storeId)

  const reportQuery = useQuery({
    queryKey: [
      mode,
      "reports",
      "sales",
      storeId,
      appliedFrom,
      appliedTo,
      page,
    ],
    enabled,
    queryFn: () =>
      mode === "platform"
        ? getPlatformSalesReport({
            storeId,
            from: appliedFrom,
            to: appliedTo,
            page,
            pageSize: ADMIN_TABLE_PAGE_SIZE,
          })
        : getAdminSalesReport({
            from: appliedFrom,
            to: appliedTo,
            page,
            pageSize: ADMIN_TABLE_PAGE_SIZE,
          }),
  })

  const dailyColumns = useMemo<AppColumnDef<SalesReportDaily>[]>(
    () => [
      { accessorKey: "date", header: "Date" },
      { accessorKey: "orderCount", header: "Orders" },
      {
        accessorKey: "salesPaise",
        header: "Sales",
        cell: ({ row }) => formatPaise(row.original.salesPaise),
      },
    ],
    []
  )

  const orderColumns = useMemo<AppColumnDef<SalesReportOrder>[]>(
    () => [
      {
        accessorKey: "orderNumber",
        header: "Order",
        cell: ({ row }) => (
          <Link
            href={`/admin/orders/${row.original.id}`}
            className="font-medium underline-offset-4 hover:underline"
          >
            {row.original.orderNumber}
          </Link>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant="secondary">{row.original.status}</Badge>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => formatDateTime(row.original.createdAt),
      },
      {
        accessorKey: "grandTotalPaise",
        header: "Total",
        cell: ({ row }) => formatPaise(row.original.grandTotalPaise),
      },
      {
        id: "customer",
        header: "Customer",
        cell: ({ row }) =>
          row.original.customerEmail ?? row.original.customerId ?? "—",
      },
    ],
    []
  )

  function applyRange(event: React.FormEvent) {
    event.preventDefault()
    setPage(1)
    setAppliedFrom(from)
    setAppliedTo(to)
  }

  async function onExport() {
    setExportError(null)
    setExporting(true)
    try {
      if (mode === "platform") {
        if (!storeId) throw new Error("Select a store first.")
        await downloadPlatformSalesCsv({
          storeId,
          from: appliedFrom,
          to: appliedTo,
        })
      } else {
        await downloadAdminSalesCsv({ from: appliedFrom, to: appliedTo })
      }
    } catch (cause) {
      setExportError(
        cause instanceof Error ? cause.message : "Failed to export CSV."
      )
    } finally {
      setExporting(false)
    }
  }

  const data = reportQuery.data
  const summary = data?.summary

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Reports"
        description="Sales by date range. Cancelled and returned orders are excluded from sales totals."
        breadcrumbs={[{ label: "Reports" }]}
        actions={
          <Button
            type="button"
            variant="outline"
            disabled={!enabled || exporting || reportQuery.isLoading}
            onClick={() => void onExport()}
          >
            {exporting ? "Exporting…" : "Download CSV"}
          </Button>
        }
      />

      <form
        onSubmit={applyRange}
        className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card/60 p-4 sm:flex-row sm:flex-wrap sm:items-end"
      >
        {mode === "platform" && onStoreIdChange ? (
          <PlatformStoreFilter
            value={storeId}
            onChange={(id) => {
              onStoreIdChange(id)
              setPage(1)
            }}
            allowAll={false}
          />
        ) : null}
        <FieldGroup className="flex flex-row flex-wrap gap-3">
          <Field>
            <FieldLabel htmlFor="from">From</FieldLabel>
            <Input
              id="from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="to">To</FieldLabel>
            <Input
              id="to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
        </FieldGroup>
        <Button type="submit">Apply</Button>
      </form>

      {exportError ? (
        <p className="text-sm text-destructive">{exportError}</p>
      ) : null}

      {mode === "platform" && !storeId ? (
        <p className="text-sm text-muted-foreground">
          Select a store to view its sales report.
        </p>
      ) : null}

      {reportQuery.isLoading ? <DataTableSkeleton columns={3} rows={4} /> : null}

      {reportQuery.isError ? (
        <p className="text-sm text-destructive">
          {reportQuery.error instanceof Error
            ? reportQuery.error.message
            : "Failed to load report."}
        </p>
      ) : null}

      {data ? (
        <>
          {data.storeName ? (
            <p className="text-sm text-muted-foreground">
              Store: {data.storeName}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Orders</CardDescription>
                <CardTitle className="text-2xl">
                  {summary?.orderCount ?? 0}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Excludes cancelled / returned
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Gross sales</CardDescription>
                <CardTitle className="text-2xl">
                  {formatPaise(summary?.salesPaise ?? 0)}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Sum of grand totals
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Average order</CardDescription>
                <CardTitle className="text-2xl">
                  {formatPaise(summary?.averageOrderPaise ?? 0)}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Sales ÷ orders
              </CardContent>
            </Card>
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-medium">Daily sales</h2>
            <DataTable
              columns={dailyColumns}
              data={data.daily}
              emptyMessage="No sales in this range."
              paginate={false}
            />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-medium">Orders in range</h2>
            <DataTable
              columns={orderColumns}
              data={data.orders}
              emptyMessage="No orders in this range."
              paginate={false}
            />
            <ListPagination
              pagination={data.pagination}
              onPageChange={setPage}
            />
          </section>
        </>
      ) : null}
    </div>
  )
}
