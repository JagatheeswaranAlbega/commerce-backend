"use client"

import type { ReactNode } from "react"

import { SearchField } from "@/components/admin/search-field"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

type AdminFilterBarProps = {
  children: ReactNode
  className?: string
  /** Shown on the right (e.g. search). */
  end?: ReactNode
  /** When true, shows a Clear control. */
  dirty?: boolean
  onClear?: () => void
}

export function AdminFilterBar({
  children,
  className,
  end,
  dirty = false,
  onClear,
}: AdminFilterBarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border/80 bg-card/60 p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:p-4",
        className
      )}
    >
      <div className="flex flex-wrap items-end gap-3">{children}</div>
      <div className="flex flex-wrap items-end gap-3">
        {end}
        {dirty && onClear ? (
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            Clear filters
          </Button>
        ) : null}
      </div>
    </div>
  )
}

type AdminFilterFieldProps = {
  label: string
  htmlFor?: string
  children: ReactNode
  className?: string
}

export function AdminFilterField({
  label,
  htmlFor,
  children,
  className,
}: AdminFilterFieldProps) {
  return (
    <div className={cn("flex min-w-40 flex-col gap-1.5", className)}>
      <label
        className="text-xs font-medium tracking-wide text-muted-foreground"
        htmlFor={htmlFor}
      >
        {label}
      </label>
      {children}
    </div>
  )
}

export type AdminFilterOption = {
  value: string
  label: string
}

type AdminFilterSelectProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: AdminFilterOption[]
  className?: string
  triggerClassName?: string
  placeholder?: string
}

export function AdminFilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  className,
  triggerClassName,
  placeholder = "Select…",
}: AdminFilterSelectProps) {
  return (
    <AdminFilterField label={label} htmlFor={id} className={className}>
      <Select
        value={value}
        items={options}
        onValueChange={(next) => {
          if (next == null) return
          onChange(String(next))
        }}
      >
        <SelectTrigger id={id} className={cn("min-w-40", triggerClassName)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} align="start">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </AdminFilterField>
  )
}

type AdminFilterSearchProps = {
  id?: string
  label?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function AdminFilterSearch({
  id = "filter-search",
  label = "Search",
  value,
  onChange,
  placeholder = "Search…",
  className,
}: AdminFilterSearchProps) {
  return (
    <AdminFilterField label={label} htmlFor={id} className={className}>
      <SearchField
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="max-w-none min-w-56"
      />
    </AdminFilterField>
  )
}
