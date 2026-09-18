"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { DataTable, type AppColumnDef } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import {
  getAdminCustomer,
  type AdminCustomerAddress,
} from "@/lib/api/admin/customers"
import type { AdminOrder } from "@/lib/api/admin/orders"
import { formatDate } from "@/lib/format"
import { formatPaise } from "@/lib/money"

export function StoreCustomerDetail() {
  const params = useParams<{ id: string }>()
  const customerId = params.id

  const customerQuery = useQuery({
    queryKey: ["admin", "customers", customerId],
    queryFn: () => getAdminCustomer(customerId),
    enabled: Boolean(customerId),
  })

  const addressColumns = useMemo<AppColumnDef<AdminCustomerAddress>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <span>
            {row.original.name}
            {row.original.isDefault ? (
              <Badge variant="secondary" className="ml-2">
                Default
              </Badge>
            ) : null}
          </span>
        ),
      },
      {
        id: "address",
        header: "Address",
        cell: ({ row }) =>
          [
            row.original.addressLine1,
            row.original.addressLine2,
            row.original.city,
            row.original.state,
            row.original.postalCode,
            row.original.country,
          ]
            .filter(Boolean)
            .join(", "),
      },
      {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ row }) => row.original.phone ?? "—",
      },
    ],
    []
  )

  const orderColumns = useMemo<AppColumnDef<AdminOrder>[]>(
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
        cell: ({ row }) => formatDate(row.original.createdAt),
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
          {customer.email ?? "No email"} · Created {formatDate(customer.createdAt)}
        </p>
      </div>

      <section className="flex max-w-xl flex-col gap-2 text-sm">
        <h2 className="text-lg font-medium">Profile</h2>
        <p>
          <span className="text-muted-foreground">Phone:</span>{" "}
          {customer.phone ?? "—"}
        </p>
        <p>
          <span className="text-muted-foreground">Customer ID:</span>{" "}
          <span className="font-mono text-xs">{customer.id}</span>
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Addresses</h2>
        <DataTable
          columns={addressColumns}
          data={customer.addresses ?? []}
          emptyMessage="No saved addresses."
        />
      </section>

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
