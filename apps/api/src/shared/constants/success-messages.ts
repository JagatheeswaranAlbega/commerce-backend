export const SUCCESS_MESSAGES = {
  // Auth
  LOGGED_IN: "Logged in successfully",
  LOGGED_OUT: "Logged out successfully",
  TOKEN_REFRESHED: "Token refreshed successfully",
  USER_RETRIEVED: "User details retrieved successfully",
  PASSWORD_CHANGED: "Password changed successfully",
  CUSTOMER_REGISTERED: "Registered successfully",
  CUSTOMER_LOGGED_IN: "Logged in successfully",
  CUSTOMER_RETRIEVED: "Customer details retrieved successfully",

  // Products
  PRODUCTS_RETRIEVED: "Products retrieved successfully",
  PRODUCT_RETRIEVED: "Product retrieved successfully",
  PRODUCT_CREATED: "Product created successfully",
  PRODUCT_UPDATED: "Product updated successfully",
  PRODUCT_DELETED: "Product deleted successfully",

  // Variants
  VARIANTS_RETRIEVED: "Variants retrieved successfully",
  VARIANT_CREATED: "Variant created successfully",
  VARIANT_UPDATED: "Variant updated successfully",
  VARIANT_DELETED: "Variant deleted successfully",

  // Categories
  CATEGORIES_RETRIEVED: "Categories retrieved successfully",
  CATEGORY_RETRIEVED: "Category retrieved successfully",
  CATEGORY_CREATED: "Category created successfully",
  CATEGORY_UPDATED: "Category updated successfully",
  CATEGORY_DELETED: "Category deleted successfully",

  // Global catalog
  GLOBAL_CATEGORIES_RETRIEVED: "Global categories retrieved successfully",
  GLOBAL_CATEGORY_RETRIEVED: "Global category retrieved successfully",
  GLOBAL_CATEGORY_CREATED: "Global category created successfully",
  GLOBAL_CATEGORY_UPDATED: "Global category updated successfully",
  GLOBAL_CATEGORY_DELETED: "Global category deleted successfully",
  GLOBAL_PRODUCTS_RETRIEVED: "Global products retrieved successfully",
  GLOBAL_PRODUCT_RETRIEVED: "Global product retrieved successfully",
  GLOBAL_PRODUCT_CREATED: "Global product created successfully",
  GLOBAL_PRODUCT_UPDATED: "Global product updated successfully",
  GLOBAL_PRODUCT_DELETED: "Global product deleted successfully",
  GLOBAL_VARIANT_CREATED: "Global variant created successfully",
  GLOBAL_VARIANT_UPDATED: "Global variant updated successfully",
  GLOBAL_VARIANT_DELETED: "Global variant deleted successfully",
  GLOBAL_PRODUCT_IMPORTED: "Global product imported into your store",
  GLOBAL_PRODUCTS_IMPORTED: "Selected global products imported into your store",
  GLOBAL_PRODUCTS_IMPORT_NONE: "No products were imported",
  GLOBAL_PRODUCT_REMOVED: "Global product removed from your store",

  // Collections
  COLLECTIONS_RETRIEVED: "Collections retrieved successfully",
  COLLECTION_RETRIEVED: "Collection retrieved successfully",
  COLLECTION_CREATED: "Collection created successfully",
  COLLECTION_UPDATED: "Collection updated successfully",
  COLLECTION_DELETED: "Collection deleted successfully",
  COLLECTION_PRODUCT_ADDED: "Product added to collection successfully",
  COLLECTION_PRODUCT_REMOVED: "Product removed from collection successfully",

  // Inventory
  INVENTORY_RETRIEVED: "Inventory retrieved successfully",
  INVENTORY_ITEM_RETRIEVED: "Inventory item retrieved successfully",
  INVENTORY_ADJUSTED: "Inventory adjusted successfully",

  // Orders
  ORDERS_RETRIEVED: "Orders retrieved successfully",
  ORDER_RETRIEVED: "Order retrieved successfully",
  ORDER_UPDATED: "Order updated successfully",
  ORDER_CREATED: "Order created successfully",
  ORDER_STATUS_CHANGED: "Status changed successfully",
  FULFILLMENT_CREATED: "Fulfillment created successfully",
  RETURNS_RETRIEVED: "Returns retrieved successfully",
  RETURN_RETRIEVED: "Return retrieved successfully",
  RETURN_REQUESTED: "Return requested successfully",
  RETURN_APPROVED: "Return approved and stock restored",
  RETURN_REJECTED: "Return rejected successfully",

  // Customers
  CUSTOMERS_RETRIEVED: "Customers retrieved successfully",
  CUSTOMER_DETAILS_RETRIEVED: "Customer details retrieved successfully",
  CUSTOMER_UPDATED: "Customer updated successfully",

  // Discounts
  DISCOUNTS_RETRIEVED: "Discounts retrieved successfully",
  DISCOUNT_CREATED: "Discount created successfully",
  DISCOUNT_UPDATED: "Discount updated successfully",
  DISCOUNT_DELETED: "Discount deleted successfully",
  DISCOUNT_APPLIED: "Discount applied successfully",
  DISCOUNT_REMOVED: "Discount removed successfully",

  // Settings
  SETTINGS_RETRIEVED: "Settings retrieved successfully",
  SETTINGS_SAVED: "Settings saved successfully",

  // API keys
  API_KEYS_RETRIEVED: "API keys retrieved successfully",
  API_KEY_GENERATED: "API key generated successfully",
  API_KEY_DELETED: "API key deleted successfully",

  // Media
  MEDIA_RETRIEVED: "Media retrieved successfully",
  MEDIA_UPLOADED: "Media uploaded successfully",
  MEDIA_UPDATED: "Media updated successfully",
  MEDIA_DELETED: "Media deleted successfully",
  MEDIA_THUMBNAIL_UPDATED: "Product thumbnail updated successfully",

  // Stores / platform
  METRICS_RETRIEVED: "Metrics retrieved successfully",
  SALES_REPORT_RETRIEVED: "Sales report retrieved successfully",
  STORES_RETRIEVED: "Stores retrieved successfully",
  STORE_RETRIEVED: "Store retrieved successfully",
  STORE_CREATED: "Store created successfully",
  STORE_UPDATED: "Store updated successfully",
  STORE_STATUS_CHANGED: "Status changed successfully",
  STORE_DELETED: "Store deleted successfully",
  STORE_ADMINS_RETRIEVED: "Store admins retrieved successfully",
  STORE_ADMIN_CREATED: "Store admin created successfully",
  STORE_ADMIN_UPDATED: "Store admin updated successfully",
  STORE_ADMIN_DELETED: "Store admin deleted successfully",
  AUDIT_LOGS_RETRIEVED: "Audit logs retrieved successfully",

  // Cart / checkout
  CART_CREATED: "Cart created successfully",
  CART_RETRIEVED: "Cart retrieved successfully",
  CART_ITEM_ADDED: "Item added to cart successfully",
  CART_ITEM_UPDATED: "Cart item updated successfully",
  CART_ITEM_REMOVED: "Cart item removed successfully",
  CART_ADDRESS_UPDATED: "Cart address updated successfully",
  CART_EMAIL_UPDATED: "Cart email updated successfully",
  CART_CLEARED: "Cart cleared successfully",
  ORDER_LOOKUP_RETRIEVED: "Order retrieved successfully",

  // Addresses
  ADDRESSES_RETRIEVED: "Addresses retrieved successfully",
  ADDRESS_CREATED: "Address created successfully",
  ADDRESS_UPDATED: "Address updated successfully",
  ADDRESS_DELETED: "Address deleted successfully",

  // Wishlist
  WISHLIST_RETRIEVED: "Wishlist retrieved successfully",
  WISHLIST_ITEM_ADDED: "Item added to wishlist successfully",
  WISHLIST_ITEM_REMOVED: "Wishlist item removed successfully",

  // Health / misc
  HEALTH_OK: "Service is healthy",
  REQUEST_COMPLETED: "Request completed successfully",
} as const;

export type SuccessMessage = (typeof SUCCESS_MESSAGES)[keyof typeof SUCCESS_MESSAGES];
