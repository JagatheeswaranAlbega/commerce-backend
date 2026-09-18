import { pgEnum } from "drizzle-orm/pg-core";

export const storeStatusEnum = pgEnum("store_status", ["ACTIVE", "INACTIVE"]);

export const userRoleEnum = pgEnum("user_role", ["PLATFORM_SUPER_ADMIN", "STORE_ADMIN"]);

export const apiKeyTypeEnum = pgEnum("api_key_type", ["PUBLISHABLE", "SECRET"]);

export const apiKeyStatusEnum = pgEnum("api_key_status", ["ACTIVE", "REVOKED"]);

export const productStatusEnum = pgEnum("product_status", ["DRAFT", "ACTIVE", "ARCHIVED"]);

export const categoryStatusEnum = pgEnum("category_status", ["ACTIVE", "INACTIVE"]);

export const collectionStatusEnum = pgEnum("collection_status", ["ACTIVE", "INACTIVE"]);

export const variantStatusEnum = pgEnum("variant_status", ["DRAFT", "ACTIVE", "ARCHIVED"]);

export const cartStatusEnum = pgEnum("cart_status", ["ACTIVE", "CHECKED_OUT", "ABANDONED"]);

export const orderStatusEnum = pgEnum("order_status", [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
]);

export const orderReturnStatusEnum = pgEnum("order_return_status", [
  "REQUESTED",
  "APPROVED",
  "REJECTED",
]);

export const inventoryMovementTypeEnum = pgEnum("inventory_movement_type", [
  "IN",
  "OUT",
  "ADJUSTMENT",
  "RESERVE",
  "RELEASE",
  "SALE",
  "RETURN",
]);

export const discountTypeEnum = pgEnum("discount_type", ["PERCENTAGE", "FIXED_PAISE"]);

export const discountStatusEnum = pgEnum("discount_status", ["ACTIVE", "INACTIVE"]);
