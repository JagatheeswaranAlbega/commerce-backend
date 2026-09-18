export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

export function normalizeDomain(host: string): string {
  const withoutProtocol = host.trim().toLowerCase().replace(/^https?:\/\//, "");
  const withoutPath = withoutProtocol.split("/")[0] ?? "";
  const withoutTrailingDot = withoutPath.replace(/\.$/, "");
  const [withoutPort] = withoutTrailingDot.split(":");

  return withoutPort ?? "";
}
