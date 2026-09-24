import { and, desc, eq } from "drizzle-orm";
import { carts } from "@/db/schema/carts";
import { customerAddresses } from "@/db/schema/customer-addresses";
import { customers } from "@/db/schema/customers";
import type { Database } from "@/db/client";
import type { CustomerGender } from "./customer.schemas";

export type CustomerProfile = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  dateOfBirth: string | null;
  gender: CustomerGender | null;
  storeId: string;
};

export type CustomerRow = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  storeId: string;
};

export type AddressWriteInput = {
  name: string;
  phone?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state?: string | null;
  postalCode: string;
  country?: string;
  isDefault?: boolean;
};

export type CartShippingSnapshot = {
  shippingName: string | null;
  shippingPhone: string | null;
  shippingAddressLine1: string | null;
  shippingAddressLine2: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingPostalCode: string | null;
  shippingCountry: string | null;
};

export function presentCustomer(customer: CustomerRow): CustomerProfile {
  return {
    id: customer.id,
    email: customer.email,
    name: customer.name,
    phone: customer.phone,
    dateOfBirth: customer.dateOfBirth,
    gender: (customer.gender as CustomerGender | null) ?? null,
    storeId: customer.storeId,
  };
}

export async function updateCustomerProfile(
  db: Database,
  storeId: string,
  customerId: string,
  input: {
    name?: string;
    phone?: string | null;
    dateOfBirth?: string | null;
    gender?: CustomerGender | null;
  },
) {
  const [updated] = await db
    .update(customers)
    .set({
      ...("name" in input ? { name: input.name } : {}),
      ...("phone" in input ? { phone: input.phone ?? null } : {}),
      ...("dateOfBirth" in input ? { dateOfBirth: input.dateOfBirth ?? null } : {}),
      ...("gender" in input ? { gender: input.gender ?? null } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(customers.id, customerId), eq(customers.storeId, storeId)))
    .returning();
  return updated ?? null;
}

export function shippingFieldsFromAddress(address: {
  name: string;
  phone: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
}): CartShippingSnapshot {
  return {
    shippingName: address.name,
    shippingPhone: address.phone,
    shippingAddressLine1: address.addressLine1,
    shippingAddressLine2: address.addressLine2,
    shippingCity: address.city,
    shippingState: address.state,
    shippingPostalCode: address.postalCode,
    shippingCountry: address.country,
  };
}

export function cartHasShippingSnapshot(cart: {
  shippingName?: string | null;
  shippingAddressLine1?: string | null;
  shippingCity?: string | null;
  shippingPostalCode?: string | null;
}): boolean {
  return Boolean(
    cart.shippingName && cart.shippingAddressLine1 && cart.shippingCity && cart.shippingPostalCode,
  );
}

export async function findDefaultCustomerAddress(
  db: Database,
  storeId: string,
  customerId: string,
) {
  return db.query.customerAddresses.findFirst({
    where: and(
      eq(customerAddresses.storeId, storeId),
      eq(customerAddresses.customerId, customerId),
      eq(customerAddresses.isDefault, true),
    ),
  });
}

export async function listCustomerAddresses(db: Database, storeId: string, customerId: string) {
  return db.query.customerAddresses.findMany({
    where: and(eq(customerAddresses.storeId, storeId), eq(customerAddresses.customerId, customerId)),
    orderBy: [desc(customerAddresses.isDefault), desc(customerAddresses.createdAt)],
  });
}

export async function getCustomerAddress(
  db: Database,
  storeId: string,
  customerId: string,
  addressId: string,
) {
  return db.query.customerAddresses.findFirst({
    where: and(
      eq(customerAddresses.id, addressId),
      eq(customerAddresses.storeId, storeId),
      eq(customerAddresses.customerId, customerId),
    ),
  });
}

async function unsetCustomerDefaults(
  db: Pick<Database, "update">,
  storeId: string,
  customerId: string,
) {
  await db
    .update(customerAddresses)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(and(eq(customerAddresses.storeId, storeId), eq(customerAddresses.customerId, customerId)));
}

export async function insertCustomerAddress(
  db: Database,
  storeId: string,
  customerId: string,
  input: AddressWriteInput,
) {
  return db.transaction(async (tx) => {
    const existing = await tx.query.customerAddresses.findMany({
      where: and(eq(customerAddresses.storeId, storeId), eq(customerAddresses.customerId, customerId)),
      columns: { id: true },
    });
    const makeDefault = Boolean(input.isDefault) || existing.length === 0;
    if (makeDefault) {
      await unsetCustomerDefaults(tx, storeId, customerId);
    }
    const [address] = await tx
      .insert(customerAddresses)
      .values({
        storeId,
        customerId,
        name: input.name,
        phone: input.phone ?? null,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2 ?? null,
        city: input.city,
        state: input.state ?? null,
        postalCode: input.postalCode,
        country: input.country ?? "IN",
        isDefault: makeDefault,
      })
      .returning();
    return address!;
  });
}

export async function deleteCustomerAddress(
  db: Database,
  storeId: string,
  customerId: string,
  addressId: string,
) {
  return db.transaction(async (tx) => {
    const existing = await tx.query.customerAddresses.findFirst({
      where: and(
        eq(customerAddresses.id, addressId),
        eq(customerAddresses.storeId, storeId),
        eq(customerAddresses.customerId, customerId),
      ),
    });
    if (!existing) return false;

    await tx
      .delete(customerAddresses)
      .where(
        and(
          eq(customerAddresses.id, addressId),
          eq(customerAddresses.storeId, storeId),
          eq(customerAddresses.customerId, customerId),
        ),
      );

    if (existing.isDefault) {
      const next = await tx.query.customerAddresses.findFirst({
        where: and(
          eq(customerAddresses.storeId, storeId),
          eq(customerAddresses.customerId, customerId),
        ),
        orderBy: [desc(customerAddresses.createdAt)],
      });
      if (next) {
        await tx
          .update(customerAddresses)
          .set({ isDefault: true, updatedAt: new Date() })
          .where(
            and(eq(customerAddresses.id, next.id), eq(customerAddresses.storeId, storeId)),
          );
      }
    }

    return true;
  });
}

export async function applyDefaultShippingToCart(
  db: Database,
  storeId: string,
  cartId: string,
  customerId: string,
  cart: {
    shippingName?: string | null;
    shippingAddressLine1?: string | null;
    shippingCity?: string | null;
    shippingPostalCode?: string | null;
  },
) {
  if (cartHasShippingSnapshot(cart)) return;
  const address = await findDefaultCustomerAddress(db, storeId, customerId);
  if (!address) return;

  await db
    .update(carts)
    .set({
      customerId,
      ...shippingFieldsFromAddress(address),
      updatedAt: new Date(),
    })
    .where(and(eq(carts.id, cartId), eq(carts.storeId, storeId)));
}
