# Complete API Plan

Base prefix:

```text
/api/v1
```

## 1. Authentication

### POST `/auth/login`

Body:

```json
{
  "email": "admin@example.com",
  "password": "..."
}
```

Returns JWT/session information plus:

- user
- role
- storeId

### POST `/auth/refresh`

Refreshes the session/token according to the chosen token strategy.

### POST `/auth/logout`

Invalidates the appropriate session/refresh token.

### GET `/auth/me`

Returns the current authenticated identity and authorization context.

## 2. Platform API

Prefix:

```text
/api/v1/platform
```

Guard:

```text
requirePlatformAdmin
```

### Stores

- `GET /platform/stores`
- `POST /platform/stores`
- `GET /platform/stores/:storeId`
- `PATCH /platform/stores/:storeId`
- `DELETE /platform/stores/:storeId`

### Store admins

- `GET /platform/stores/:storeId/admins`
- `POST /platform/stores/:storeId/admins`
- `PATCH /platform/stores/:storeId/admins/:userId`
- `DELETE /platform/stores/:storeId/admins/:userId`

### Keys

- `GET /platform/stores/:storeId/keys`
- `POST /platform/stores/:storeId/keys`
- `DELETE /platform/stores/:storeId/keys/:keyId`

### Global visibility/metrics

- `GET /platform/metrics`
- `GET /platform/orders`
- `GET /platform/products`

### Global Catalog

- `GET|POST /platform/global-categories`
- `GET|PATCH|DELETE /platform/global-categories/:categoryId`
- `GET|POST /platform/global-products`
- `GET|PATCH|DELETE /platform/global-products/:productId`
- `GET|POST /platform/global-products/:productId/variants`
- `PATCH|DELETE /platform/global-products/:productId/variants/:variantId`
- `GET /platform/global-products/:productId/media`
- `POST /platform/global-media/upload`

Exact global endpoints can be adjusted during implementation.

## 3. Store Admin API

Prefix:

```text
/api/v1/admin
```

Guard:

```text
requireStoreAdmin
```

Store ID comes from authenticated context, not the request body.

### Products

- `GET /admin/products`
- `POST /admin/products`
- `GET /admin/products/:productId`
- `PATCH /admin/products/:productId`
- `DELETE /admin/products/:productId`

### Global Catalog (read + import)

- `GET /admin/global-catalog/categories`
- `GET /admin/global-catalog/categories/:categoryId`
- `GET /admin/global-catalog/products`
- `GET /admin/global-catalog/products/:productId`
- `POST /admin/global-catalog/products/:productId/import`
- `DELETE /admin/global-catalog/products/:productId/import`

### Variants

- `POST /admin/products/:productId/variants`
- `PATCH /admin/products/:productId/variants/:variantId`
- `DELETE /admin/products/:productId/variants/:variantId`

### Categories

- `GET /admin/categories`
- `POST /admin/categories`
- `PATCH /admin/categories/:categoryId`
- `DELETE /admin/categories/:categoryId`

### Collections

- `GET /admin/collections`
- `POST /admin/collections`
- `PATCH /admin/collections/:collectionId`
- `DELETE /admin/collections/:collectionId`

### Inventory

- `GET /admin/inventory` — optional `q` (product/variant/SKU)
- `GET /admin/inventory/:variantId`
- `GET /admin/inventory/:variantId/movements`
- `POST /admin/inventory/:variantId/adjust`
- `POST /admin/inventory/:variantId/set` — set absolute available quantity

### Orders

- `GET /admin/orders` — optional `q`, `status`, `from`, `to`
- `GET /admin/orders/:orderId`
- `PATCH /admin/orders/:orderId` — status and/or `adminNote`
- `POST /admin/orders/:orderId/fulfillment`

### Settings

- `GET /admin/settings` — includes `shipping` and `tax` (GST % / GSTIN)
- `PATCH /admin/settings`

### Dashboard

- `GET /admin/dashboard` — includes `pendingOrdersCount`, `openReturnsCount`, `lowStockCount`

### Customers

- `GET /admin/customers` — optional `q` (name/email/phone)
- `GET /admin/customers/:customerId`

### Reports

- `GET /admin/reports/sales?from=&to=` — summary KPIs, daily series, paginated orders (sales exclude `CANCELLED`/`REFUNDED`)
- `GET /admin/reports/sales/export?from=&to=` — CSV of all orders in range (money columns are INR rupees with 2 decimals, e.g. `2499.00`, matching dashboard display)
- Platform: `GET /platform/reports/sales?storeId=&from=&to=` (+ `/export`)

### Returns (restock only)

- `GET /admin/returns`
- `GET /admin/returns/:returnId`
- `POST /admin/returns/:returnId/approve` — restock + order `REFUNDED` (no payment)
- `POST /admin/returns/:returnId/reject`

### Discounts

- `GET /admin/discounts`
- `POST /admin/discounts` — optional `startsAt`, `endsAt`, `minOrderPaise`, `usageLimit`
- `PATCH /admin/discounts/:discountId`
- `DELETE /admin/discounts/:discountId`

Rules (enforced on cart apply + checkout): schedule window, min order subtotal, total usage limit. `usageCount` increments on successful checkout only. No payment refunds / emails in this product slice.

## 4. Storefront API

Prefix:

```text
/api/v1/store
```

Authentication:

```http
x-publishable-key: pk_live_...
```

### Store

- `GET /store/details` — includes shipping/tax settings

### Catalog

- `GET /store/products` — `q`, `sort`, `inStock`, `minPricePaise`, `maxPricePaise`; list items include pricing + `inStock`
- `GET /store/products/:handle`
- `GET /store/categories`
- `GET /store/categories/:slug`
- `GET /store/collections`
- `GET /store/collections/:slug`

### Cart

- `POST /store/carts`
- `GET /store/carts/:cartId`
- `POST /store/carts/:cartId/email`
- `POST /store/carts/:cartId/items`
- `PATCH /store/carts/:cartId/items/:itemId`
- `DELETE /store/carts/:cartId/items/:itemId`
- `POST /store/carts/:cartId/shipping-address`

### Checkout

- `POST /store/carts/:cartId/checkout` — requires email (body, cart, or logged-in customer)

The checkout flow should validate inventory and create the order transactionally. Totals use store shipping/tax settings.

### Customer orders / returns

- `GET /store/orders/lookup?orderNumber=&email=` — guest order lookup (publishable key)
- `GET /store/orders`
- `GET /store/orders/:orderId`
- `POST /store/orders/:orderId/return` — request return on delivered order (restock after admin approve; no payment refund)

## 5. Secret-Key API

For trusted integrations, use the secret key only where server-to-server access is required.

Example:

```http
Authorization: Bearer sk_live_...
```

The secret key must resolve to one owning store.

Do not use a secret key as a platform-wide bypass.

## 6. Validation

All request bodies, query parameters, and relevant route parameters should be validated with Zod.

## 7. Error Codes

Use stable machine-readable codes such as:

```text
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
VALIDATION_ERROR
CONFLICT
TENANT_ACCESS_DENIED
INVALID_API_KEY
INVALID_SECRET_KEY
INSUFFICIENT_STOCK
DUPLICATE_RESOURCE
INTERNAL_ERROR
```

## 8. API Versioning

Keep `/api/v1`.

Breaking changes should move to a new version rather than silently changing contracts.

## 9. API Security

Never accept:

```json
{
  "storeId": "store-b"
}
```

as the source of authorization for Store Admin operations.

The store comes from authenticated context.
