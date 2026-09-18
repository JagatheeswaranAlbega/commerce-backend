"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import {
  AdminFilterBar,
  AdminFilterSearch,
  AdminFilterSelect,
} from "@/components/admin/admin-filter-bar"
import { DataTableSkeleton } from "@/components/admin/data-table-skeleton"
import { AdminPageHeader } from "@/components/admin/page-header"
import { DataTable, type AppColumnDef } from "@/components/data-table"
import { RowActionsMenu } from "@/components/row-actions-menu"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { PermissionGate } from "@/components/admin/permission-gate"
import { ApiError } from "@/lib/api"
import {
  createAdminDiscount,
  deleteAdminDiscount,
  listAdminDiscounts,
  updateAdminDiscount,
  type AdminDiscount,
  type CreateDiscountInput,
  type DiscountType,
} from "@/lib/api/admin/discounts"
import { formatDate } from "@/lib/format"
import { formatPaise } from "@/lib/money"
import { paiseToRupeesInput, rupeesToPaise } from "@/lib/money-input"

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocalValue(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const d = new Date(trimmed)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function formatWindow(discount: AdminDiscount): string {
  if (!discount.startsAt && !discount.endsAt) return "Always"
  const start = discount.startsAt ? formatDate(discount.startsAt) : "…"
  const end = discount.endsAt ? formatDate(discount.endsAt) : "…"
  return `${start} → ${end}`
}

function formatUsage(discount: AdminDiscount): string {
  const count = discount.usageCount ?? 0
  if (discount.usageLimit == null) return `${count} / ∞`
  return `${count} / ${discount.usageLimit}`
}

const discountSchema = z.object({
  code: z.string().min(1, "Code is required"),
  type: z.enum(["PERCENTAGE", "FIXED_PAISE"]),
  value: z.coerce.number().int().nonnegative(),
  status: z.enum(["ACTIVE", "INACTIVE"]),
})

export default function AdminDiscountsPage() {
  return (
    <PermissionGate permission="discounts.read">
      <DiscountsPageContent />
    </PermissionGate>
  )
}

function DiscountsPageContent() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AdminDiscount | null>(null)
  const [code, setCode] = useState("")
  const [type, setType] = useState<DiscountType>("PERCENTAGE")
  const [value, setValue] = useState("10")
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE")
  const [startsAt, setStartsAt] = useState("")
  const [endsAt, setEndsAt] = useState("")
  const [minOrderRupees, setMinOrderRupees] = useState("")
  const [usageLimit, setUsageLimit] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">(
    "ALL"
  )
  const [typeFilter, setTypeFilter] = useState<"ALL" | DiscountType>("ALL")

  const discountsQuery = useQuery({
    queryKey: ["admin", "discounts"],
    queryFn: () => listAdminDiscounts({ pageSize: 100 }),
  })

  const createMutation = useMutation({
    mutationFn: createAdminDiscount,
    onSuccess: async () => {
      closeDialog()
      await queryClient.invalidateQueries({ queryKey: ["admin", "discounts"] })
    },
    onError: (cause) => {
      setError(
        cause instanceof ApiError ? cause.message : "Failed to create discount."
      )
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: CreateDiscountInput
    }) => updateAdminDiscount(id, input),
    onSuccess: async () => {
      closeDialog()
      await queryClient.invalidateQueries({ queryKey: ["admin", "discounts"] })
    },
    onError: (cause) => {
      setError(
        cause instanceof ApiError ? cause.message : "Failed to update discount."
      )
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteAdminDiscount,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "discounts"] })
    },
  })

  const filteredDiscounts = useMemo(() => {
    const items = discountsQuery.data?.data ?? []
    const q = search.trim().toLowerCase()
    return items.filter((discount) => {
      if (statusFilter !== "ALL" && discount.status !== statusFilter) {
        return false
      }
      if (typeFilter !== "ALL" && discount.type !== typeFilter) return false
      if (!q) return true
      return discount.code.toLowerCase().includes(q)
    })
  }, [discountsQuery.data?.data, search, statusFilter, typeFilter])

  const columns = useMemo<AppColumnDef<AdminDiscount>[]>(
    () => [
      {
        accessorKey: "code",
        header: "Code",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.code}</span>
        ),
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => row.original.type,
      },
      {
        accessorKey: "value",
        header: "Value",
        cell: ({ row }) =>
          row.original.type === "PERCENTAGE"
            ? `${row.original.value}%`
            : formatPaise(row.original.value),
      },
      {
        id: "window",
        header: "Window",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatWindow(row.original)}
          </span>
        ),
      },
      {
        id: "minOrder",
        header: "Min order",
        cell: ({ row }) =>
          row.original.minOrderPaise != null
            ? formatPaise(row.original.minOrderPaise)
            : "—",
      },
      {
        id: "usage",
        header: "Usage",
        cell: ({ row }) => formatUsage(row.original),
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
        sortFn: "datetime",
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <RowActionsMenu
            label="Discount actions"
            items={[
              {
                label: "Edit",
                onClick: () => openEdit(row.original),
              },
              {
                label: "Delete",
                variant: "destructive",
                disabled: deleteMutation.isPending,
                onClick: () => deleteMutation.mutate(row.original.id),
              },
            ]}
          />
        ),
      },
    ],
    [deleteMutation]
  )

  function closeDialog() {
    setDialogOpen(false)
    setEditing(null)
    setCode("")
    setType("PERCENTAGE")
    setValue("10")
    setStatus("ACTIVE")
    setStartsAt("")
    setEndsAt("")
    setMinOrderRupees("")
    setUsageLimit("")
    setError(null)
  }

  function openCreate() {
    closeDialog()
    setDialogOpen(true)
  }

  function openEdit(discount: AdminDiscount) {
    setEditing(discount)
    setCode(discount.code)
    setType(discount.type)
    setValue(String(discount.value))
    setStatus(discount.status)
    setStartsAt(toDatetimeLocalValue(discount.startsAt))
    setEndsAt(toDatetimeLocalValue(discount.endsAt))
    setMinOrderRupees(
      discount.minOrderPaise != null
        ? paiseToRupeesInput(discount.minOrderPaise)
        : ""
    )
    setUsageLimit(
      discount.usageLimit != null ? String(discount.usageLimit) : ""
    )
    setError(null)
    setDialogOpen(true)
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const parsed = discountSchema.safeParse({
      code: code.trim().toUpperCase(),
      type,
      value,
      status,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input")
      return
    }
    if (parsed.data.type === "PERCENTAGE" && parsed.data.value > 100) {
      setError("Percentage cannot exceed 100")
      return
    }

    const startIso = fromDatetimeLocalValue(startsAt)
    const endIso = fromDatetimeLocalValue(endsAt)
    if (startsAt.trim() && !startIso) {
      setError("Invalid start date")
      return
    }
    if (endsAt.trim() && !endIso) {
      setError("Invalid end date")
      return
    }
    if (startIso && endIso && new Date(startIso) >= new Date(endIso)) {
      setError("Start must be before end")
      return
    }

    let minOrderPaise: number | null = null
    if (minOrderRupees.trim()) {
      const parsedMin = rupeesToPaise(minOrderRupees)
      if (parsedMin == null || parsedMin < 0) {
        setError("Invalid minimum order amount")
        return
      }
      minOrderPaise = parsedMin
    }

    let usageLimitValue: number | null = null
    if (usageLimit.trim()) {
      const n = Number(usageLimit)
      if (!Number.isInteger(n) || n < 1) {
        setError("Usage limit must be a positive integer")
        return
      }
      usageLimitValue = n
    }

    const input: CreateDiscountInput = {
      ...parsed.data,
      startsAt: startIso,
      endsAt: endIso,
      minOrderPaise,
      usageLimit: usageLimitValue,
    }

    if (editing) {
      updateMutation.mutate({ id: editing.id, input })
      return
    }
    createMutation.mutate(input)
  }

  const saving = createMutation.isPending || updateMutation.isPending

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Discounts"
        description="Codes with schedule, min order, and usage limits"
        breadcrumbs={[{ label: "Discounts" }]}
        actions={
          <Button type="button" onClick={openCreate}>
            Create discount
          </Button>
        }
      />

      <AdminFilterBar
        dirty={
          statusFilter !== "ALL" ||
          typeFilter !== "ALL" ||
          search.trim() !== ""
        }
        onClear={() => {
          setStatusFilter("ALL")
          setTypeFilter("ALL")
          setSearch("")
        }}
        end={
          <AdminFilterSearch
            value={search}
            onChange={setSearch}
            placeholder="Search codes…"
          />
        }
      >
        <AdminFilterSelect
          id="discount-status-filter"
          label="Status"
          value={statusFilter}
          onChange={(value) =>
            setStatusFilter(value as "ALL" | "ACTIVE" | "INACTIVE")
          }
          options={[
            { value: "ALL", label: "All statuses" },
            { value: "ACTIVE", label: "Active" },
            { value: "INACTIVE", label: "Inactive" },
          ]}
        />
        <AdminFilterSelect
          id="discount-type-filter"
          label="Type"
          value={typeFilter}
          onChange={(value) => setTypeFilter(value as "ALL" | DiscountType)}
          options={[
            { value: "ALL", label: "All types" },
            { value: "PERCENTAGE", label: "Percentage" },
            { value: "FIXED_PAISE", label: "Fixed (paise)" },
          ]}
        />
      </AdminFilterBar>

      {discountsQuery.isError ? (
        <p className="text-sm text-destructive">
          {discountsQuery.error instanceof Error
            ? discountsQuery.error.message
            : "Failed to load discounts."}
        </p>
      ) : null}

      {discountsQuery.isLoading ? (
        <DataTableSkeleton columns={6} rows={6} />
      ) : (
        <DataTable
          columns={columns}
          data={filteredDiscounts}
          emptyMessage={
            search.trim() ||
            statusFilter !== "ALL" ||
            typeFilter !== "ALL"
              ? "No discounts match your filters."
              : "No discounts yet."
          }
        />
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit discount" : "Create discount"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="code">Code</FieldLabel>
                <Input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="type">Type</FieldLabel>
                <select
                  id="type"
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={type}
                  onChange={(e) => setType(e.target.value as DiscountType)}
                  disabled={saving}
                >
                  <option value="PERCENTAGE">Percentage</option>
                  <option value="FIXED_PAISE">Fixed paise</option>
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="value">
                  {type === "PERCENTAGE" ? "Percent" : "Amount (paise)"}
                </FieldLabel>
                <Input
                  id="value"
                  type="number"
                  min={0}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="status">Status</FieldLabel>
                <select
                  id="status"
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as "ACTIVE" | "INACTIVE")
                  }
                  disabled={saving}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="startsAt">Starts at (optional)</FieldLabel>
                <Input
                  id="startsAt"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="endsAt">Ends at (optional)</FieldLabel>
                <Input
                  id="endsAt"
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="minOrder">
                  Min order (₹, optional)
                </FieldLabel>
                <Input
                  id="minOrder"
                  inputMode="decimal"
                  placeholder="e.g. 500"
                  value={minOrderRupees}
                  onChange={(e) => setMinOrderRupees(e.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="usageLimit">
                  Usage limit (optional)
                </FieldLabel>
                <Input
                  id="usageLimit"
                  type="number"
                  min={1}
                  placeholder="Unlimited if empty"
                  value={usageLimit}
                  onChange={(e) => setUsageLimit(e.target.value)}
                  disabled={saving}
                />
              </Field>
              {editing ? (
                <p className="text-sm text-muted-foreground">
                  Used {editing.usageCount ?? 0}
                  {editing.usageLimit != null
                    ? ` of ${editing.usageLimit}`
                    : ""}{" "}
                  times (read-only).
                </p>
              ) : null}
            </FieldGroup>
            {error ? <FieldError>{error}</FieldError> : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : editing ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
