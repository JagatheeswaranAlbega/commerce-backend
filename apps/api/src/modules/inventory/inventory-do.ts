import type { Context } from "hono";
import type { AppEnv } from "@/shared/types/hono";

export async function coordinateInventory(
  c: Context<AppEnv>,
  storeId: string,
  variantId: string,
  reference: string,
  quantity: number,
): Promise<void> {
  const ns = c.env.INVENTORY;
  if (!ns) return;

  const id = ns.idFromName(`inventory:${storeId}:${variantId}`);
  const stub = ns.get(id);
  await stub.fetch("https://inventory/coordinate", { method: "POST" });
  await stub.fetch("https://inventory/reservations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference, quantity, action: "set" }),
  });
}

export async function clearInventoryReservation(
  c: Context<AppEnv>,
  storeId: string,
  variantId: string,
  reference: string,
): Promise<void> {
  const ns = c.env.INVENTORY;
  if (!ns) return;

  const id = ns.idFromName(`inventory:${storeId}:${variantId}`);
  const stub = ns.get(id);
  await stub.fetch("https://inventory/reservations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference, action: "clear" }),
  });
}
