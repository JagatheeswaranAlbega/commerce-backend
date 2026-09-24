export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

let defaultFormatTimeZone: string | undefined

/** Used by AdminShell so store Regional timezone applies across admin dates. */
export function setDefaultFormatTimeZone(timeZone: string | undefined) {
  defaultFormatTimeZone = timeZone || undefined
}

export function formatDate(value: string, timeZone?: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  const zone = timeZone ?? defaultFormatTimeZone
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(zone ? { timeZone: zone } : {}),
  })
}

/** Date + time for order placement and similar event timestamps. */
export function formatDateTime(value: string, timeZone?: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  const zone = timeZone ?? defaultFormatTimeZone
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(zone ? { timeZone: zone } : {}),
  })
}
