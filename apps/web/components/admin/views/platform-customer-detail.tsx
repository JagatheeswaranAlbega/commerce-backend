"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { DataTable, type AppColumnDef } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { getPlatformCustomer } from "@/lib/api/platform/customers"
import { listPlatformStores } from "@/lib/api/platform/stores"
import { formatDateTime } from "@/lib/format"
import { formatPaise } from "@/lib/money"

export function PlatformCustomerDetail() {
  const params = useParams<{ id: string }>()
  const customerId = params.id

  const customerQuery = useQuery({
    queryKey: ["platform", "customers", customerId],
    queryFn: () => getPlatformCustomer(customerId),
    enabled: Boolean(customerId),
  })

  const storesQuery = useQuery({
    queryKey: ["platform", "stores"],
    queryFn: () => listPlatformStores({ pageSize: 100 }),
  })

  const orderColumns = useMemo<
    AppColumnDef<{
      id: string
      orderNumber: string
      status: string
      grandTotalPaise: number
      createdAt: string
    }>[]
  >(
    () => [
      {
        accessorKey: "orderNumber",
        header: "Order",
        cell: ({ row }) => (
          <Link
            href={`/admin/orders/${row.original.id}`}
            className="font-medium hover:underline"
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
        accessorKey: "grandTotalPaise",
        header: "Total",
        cell: ({ row }) => formatPaise(row.original.grandTotalPaise),
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => formatDateTime(row.original.createdAt),
      },
    ],
    []
  )

  if (customerQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>
  }

  if (customerQuery.isError || !customerQuery.data) {
    return (
      <p className="text-sm text-destructive">
        {customerQuery.error instanceof Error
          ? customerQuery.error.message
          : "Customer not found."}
      </p>
    )
  }

  const customer = customerQuery.data
  const storeName =
    storesQuery.data?.data.find((s) => s.id === customer.storeId)?.name ??
    customer.storeId

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/admin/customers"
          className="text-sm text-muted-foreground hover:underline"
        >
          Back to customers
        </Link>
        <h1 className="text-2xl font-medium">{customer.name ?? "Customer"}</h1>
        <p className="text-sm text-muted-foreground">
          {customer.email ?? "No email"} · {storeName}
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Orders</h2>
        <DataTable
          columns={orderColumns}
          data={customer.orders ?? []}
          emptyMessage="No orders for this customer."
        />
      </section>
    </div>
  )
}
