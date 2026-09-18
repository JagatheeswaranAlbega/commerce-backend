import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "@/db/client";
import { inventory } from "@/db/schema/inventory";
import { inventoryMovements } from "@/db/schema/inventory-movements";
import { orderReturns } from "@/db/schema/order-returns";
import { InvalidStateError } from "@/shared/errors/app-error";

export type OrderReturnStatus = "REQUESTED" | "APPROVED" | "REJECTED";

export const RETURNABLE_ORDER_STATUS = "DELIVERED" as const;

export const BLOCKING_RETURN_STATUSES: OrderReturnStatus[] = ["REQUESTED", "APPROVED"];

export function assertOrderCanRequestReturn(orderStatus: string): void {
  if (orderStatus !== RETURNABLE_ORDER_STATUS) {
    throw new InvalidStateError("Only delivered orders can be returned.");
  }
}

export function assertReturnIsRequested(status: string): void {
  if (status !== "REQUESTED") {
    throw new InvalidStateError("Return is not awaiting a decision.");
  }
}

export type RestorableOrderItem = {
  variantId: string | null;
  quantity: number;
};

/** Restore stock for all order lines and write RETURN inventory movements. */
export async function restoreOrderStock(
  tx: Database,
  storeId: string,
  orderId: string,
  items: RestorableOrderItem[],
): Promise<void> {
  for (const item of items) {
    if (!item.variantId) {
      throw new InvalidStateError("Cannot restore stock for an order item without a variant.");
    }
    const variantId = item.variantId;
    const stock = await tx.query.inventory.findFirst({
      where: and(eq(inventory.storeId, storeId), eq(inventory.variantId, variantId)),
    });
    if (!stock) {
      throw new InvalidStateError(`Inventory missing for variant ${variantId}.`);
    }
    await tx
      .update(inventory)
      .set({
        availableQuantity: stock.availableQuantity + item.quantity,
        updatedAt: new Date(),
      })
      .where(eq(inventory.id, stock.id));
    await tx.insert(inventoryMovements).values({
      storeId,
      variantId,
      type: "RETURN",
      quantity: item.quantity,
      reference: orderId,
    });
  }
}

/** Active REQUESTED or APPROVED return blocks a new request. */
export async function findBlockingReturn(db: Database, storeId: string, orderId: string) {
  return db.query.orderReturns.findFirst({
    where: and(
      eq(orderReturns.storeId, storeId),
      eq(orderReturns.orderId, orderId),
      inArray(orderReturns.status, BLOCKING_RETURN_STATUSES),
    ),
  });
}
