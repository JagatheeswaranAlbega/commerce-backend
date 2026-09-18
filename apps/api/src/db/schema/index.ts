import { relations } from "drizzle-orm";
import { apiKeys } from "./api-keys";
import { auditLogs } from "./audit-logs";
import { cartLineItems } from "./cart-line-items";
import { carts } from "./carts";
import { categories } from "./categories";
import { collectionProducts } from "./collection-products";
import { collections } from "./collections";
import { customerAddresses } from "./customer-addresses";
import { customers } from "./customers";
import { discounts } from "./discounts";
import {
  apiKeyStatusEnum,
  apiKeyTypeEnum,
  cartStatusEnum,
  categoryStatusEnum,
  collectionStatusEnum,
  discountStatusEnum,
  discountTypeEnum,
  inventoryMovementTypeEnum,
  orderReturnStatusEnum,
  orderStatusEnum,
  productStatusEnum,
  storeStatusEnum,
  userRoleEnum,
  variantStatusEnum,
} from "./enums";
import { inventory } from "./inventory";
import { inventoryMovements } from "./inventory-movements";
import { orderItems } from "./order-items";
import { orderReturns } from "./order-returns";
import { orders } from "./orders";
import { platformSettings } from "./platform-settings";
import { productImages } from "./product-images";
import { productVariants } from "./product-variants";
import { products } from "./products";
import { refreshTokens } from "./refresh-tokens";
import { storeSettings } from "./store-settings";
import { stores } from "./stores";
import { users } from "./users";

export const storesRelations = relations(stores, ({ many }) => ({
  users: many(users),
  apiKeys: many(apiKeys),
  settings: many(storeSettings),
  products: many(products),
  categories: many(categories),
  collections: many(collections),
  customers: many(customers),
  carts: many(carts),
  orders: many(orders),
  orderReturns: many(orderReturns),
  discounts: many(discounts),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  store: one(stores, {
    fields: [users.storeId],
    references: [stores.id],
  }),
  refreshTokens: many(refreshTokens),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  store: one(stores, {
    fields: [apiKeys.storeId],
    references: [stores.id],
  }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

export const storeSettingsRelations = relations(storeSettings, ({ one }) => ({
  store: one(stores, {
    fields: [storeSettings.storeId],
    references: [stores.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  store: one(stores, {
    fields: [categories.storeId],
    references: [stores.id],
  }),
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "category_parent",
  }),
  children: many(categories, { relationName: "category_parent" }),
  products: many(products),
}));

export const collectionsRelations = relations(collections, ({ one, many }) => ({
  store: one(stores, {
    fields: [collections.storeId],
    references: [stores.id],
  }),
  products: many(collectionProducts),
}));

export const collectionProductsRelations = relations(collectionProducts, ({ one }) => ({
  store: one(stores, {
    fields: [collectionProducts.storeId],
    references: [stores.id],
  }),
  collection: one(collections, {
    fields: [collectionProducts.collectionId],
    references: [collections.id],
  }),
  product: one(products, {
    fields: [collectionProducts.productId],
    references: [products.id],
  }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  store: one(stores, {
    fields: [products.storeId],
    references: [stores.id],
  }),
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  variants: many(productVariants),
  images: many(productImages),
  collections: many(collectionProducts),
}));

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  store: one(stores, {
    fields: [productVariants.storeId],
    references: [stores.id],
  }),
  product: one(products, {
    fields: [productVariants.productId],
    references: [products.id],
  }),
  inventory: one(inventory, {
    fields: [productVariants.id],
    references: [inventory.variantId],
  }),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  store: one(stores, {
    fields: [productImages.storeId],
    references: [stores.id],
  }),
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  store: one(stores, {
    fields: [customers.storeId],
    references: [stores.id],
  }),
  addresses: many(customerAddresses),
  carts: many(carts),
  orders: many(orders),
  orderReturns: many(orderReturns),
}));

export const customerAddressesRelations = relations(customerAddresses, ({ one }) => ({
  store: one(stores, {
    fields: [customerAddresses.storeId],
    references: [stores.id],
  }),
  customer: one(customers, {
    fields: [customerAddresses.customerId],
    references: [customers.id],
  }),
}));

export const cartsRelations = relations(carts, ({ one, many }) => ({
  store: one(stores, {
    fields: [carts.storeId],
    references: [stores.id],
  }),
  customer: one(customers, {
    fields: [carts.customerId],
    references: [customers.id],
  }),
  items: many(cartLineItems),
}));

export const cartLineItemsRelations = relations(cartLineItems, ({ one }) => ({
  store: one(stores, {
    fields: [cartLineItems.storeId],
    references: [stores.id],
  }),
  cart: one(carts, {
    fields: [cartLineItems.cartId],
    references: [carts.id],
  }),
  variant: one(productVariants, {
    fields: [cartLineItems.variantId],
    references: [productVariants.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  store: one(stores, {
    fields: [orders.storeId],
    references: [stores.id],
  }),
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  items: many(orderItems),
  returns: many(orderReturns),
}));

export const orderReturnsRelations = relations(orderReturns, ({ one }) => ({
  store: one(stores, {
    fields: [orderReturns.storeId],
    references: [stores.id],
  }),
  order: one(orders, {
    fields: [orderReturns.orderId],
    references: [orders.id],
  }),
  customer: one(customers, {
    fields: [orderReturns.customerId],
    references: [customers.id],
  }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  store: one(stores, {
    fields: [orderItems.storeId],
    references: [stores.id],
  }),
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [orderItems.variantId],
    references: [productVariants.id],
  }),
}));

export const inventoryRelations = relations(inventory, ({ one }) => ({
  store: one(stores, {
    fields: [inventory.storeId],
    references: [stores.id],
  }),
  variant: one(productVariants, {
    fields: [inventory.variantId],
    references: [productVariants.id],
  }),
}));

export const inventoryMovementsRelations = relations(inventoryMovements, ({ one }) => ({
  store: one(stores, {
    fields: [inventoryMovements.storeId],
    references: [stores.id],
  }),
  variant: one(productVariants, {
    fields: [inventoryMovements.variantId],
    references: [productVariants.id],
  }),
}));

export const discountsRelations = relations(discounts, ({ one }) => ({
  store: one(stores, {
    fields: [discounts.storeId],
    references: [stores.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  store: one(stores, {
    fields: [auditLogs.storeId],
    references: [stores.id],
  }),
  actor: one(users, {
    fields: [auditLogs.actorUserId],
    references: [users.id],
  }),
}));

export const schema = {
  stores,
  users,
  apiKeys,
  refreshTokens,
  storeSettings,
  platformSettings,
  categories,
  collections,
  collectionProducts,
  products,
  productVariants,
  productImages,
  customers,
  customerAddresses,
  carts,
  cartLineItems,
  orders,
  orderItems,
  orderReturns,
  inventory,
  inventoryMovements,
  discounts,
  auditLogs,
  storesRelations,
  usersRelations,
  apiKeysRelations,
  refreshTokensRelations,
  storeSettingsRelations,
  categoriesRelations,
  collectionsRelations,
  collectionProductsRelations,
  productsRelations,
  productVariantsRelations,
  productImagesRelations,
  customersRelations,
  customerAddressesRelations,
  cartsRelations,
  cartLineItemsRelations,
  ordersRelations,
  orderItemsRelations,
  orderReturnsRelations,
  inventoryRelations,
  inventoryMovementsRelations,
  discountsRelations,
  auditLogsRelations,
};

export {
  apiKeys,
  apiKeyStatusEnum,
  apiKeyTypeEnum,
  auditLogs,
  cartLineItems,
  carts,
  cartStatusEnum,
  categories,
  categoryStatusEnum,
  collectionProducts,
  collections,
  collectionStatusEnum,
  customerAddresses,
  customers,
  discounts,
  discountStatusEnum,
  discountTypeEnum,
  inventory,
  inventoryMovementTypeEnum,
  inventoryMovements,
  orderItems,
  orderReturns,
  orderReturnStatusEnum,
  orders,
  orderStatusEnum,
  platformSettings,
  productImages,
  productStatusEnum,
  productVariants,
  products,
  refreshTokens,
  storeSettings,
  stores,
  storeStatusEnum,
  userRoleEnum,
  users,
  variantStatusEnum,
};
