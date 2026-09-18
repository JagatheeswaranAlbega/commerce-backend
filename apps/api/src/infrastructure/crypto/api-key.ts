const encoder = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return toHex(new Uint8Array(digest));
}

export function generateApiKey(type: "PUBLISHABLE" | "SECRET"): { rawKey: string; prefix: string } {
  const random = crypto.getRandomValues(new Uint8Array(24));
  const body = toHex(random);
  if (type === "PUBLISHABLE") {
    const rawKey = `pk_live_${body}`;
    return { rawKey, prefix: rawKey.slice(0, 16) };
  }
  const rawKey = `sk_live_${body}`;
  return { rawKey, prefix: rawKey.slice(0, 16) };
}
