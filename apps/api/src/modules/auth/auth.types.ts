export const USER_ROLES = {
  PLATFORM_SUPER_ADMIN: "PLATFORM_SUPER_ADMIN",
  STORE_ADMIN: "STORE_ADMIN",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const ACCESS_TYPES = {
  PLATFORM_ADMIN: "PLATFORM_ADMIN",
  STORE_ADMIN: "STORE_ADMIN",
  STOREFRONT: "STOREFRONT",
  SECRET_KEY: "SECRET_KEY",
  CUSTOMER: "CUSTOMER",
} as const;

export type AccessType = (typeof ACCESS_TYPES)[keyof typeof ACCESS_TYPES];

export type AdminJwtPayload = {
  sub: string;
  role: UserRole;
  storeId: string | null;
  typ: "admin";
};

export type CustomerJwtPayload = {
  sub: string;
  storeId: string;
  typ: "customer";
};

export type AuthJwtPayload = AdminJwtPayload | CustomerJwtPayload;

export type RequestAuthContext = {
  accessType: AccessType;
  userId?: string;
  customerId?: string;
  role?: UserRole;
  storeId: string | null;
  email?: string;
  apiKeyId?: string;
};
