/** Format integer paise as INR display string. */
export function formatPaise(paise: number | string | null | undefined): string {
  const value = typeof paise === "string" ? Number(paise) : (paise ?? 0)
  if (!Number.isFinite(value)) {
    return "—"
  }
  const rupees = value / 100
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(rupees)
}
