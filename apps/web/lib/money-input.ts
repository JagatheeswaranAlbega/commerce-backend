/** Convert rupee display string to integer paise. */
export function rupeesToPaise(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const rupees = Number(trimmed)
  if (!Number.isFinite(rupees) || rupees < 0) return null
  return Math.round(rupees * 100)
}

/** Convert integer paise to rupee input string. */
export function paiseToRupeesInput(paise: number): string {
  return (paise / 100).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")
}
