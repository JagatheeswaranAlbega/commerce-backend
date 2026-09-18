# Detailed System Architecture

## 1. System Topology

```text
                         ┌──────────────────────────┐
                         │       Frontends          │
                         │ Store A / Store B / ... │
                         └────────────┬─────────────┘
                                      │
                  ┌───────────────────┴──────────────────┐
                  │                                      │
          x-publishable-key                       JWT / Secret Key
                  │                                      │
                  ▼                                      ▼
          ┌────────────────────────────────────────────────────┐
          │              Cloudflare Workers API               │
          │                    Hono + TS                       │
          │                                                    │
          │  Auth │ Platform │ Admin │ Store │ Middleware     │
          └─────────────────────────┬──────────────────────────┘
                                    │
                              Cloudflare
                              Hyperdrive
                                    │
                                    ▼
                              PostgreSQL
                                    │
                                    ├── stores
                                    ├── users
                                    ├── api_keys
                                    ├── products
                                    ├── variants
                                    ├── inventory
                                    ├── categories
                                    ├── carts
                                    ├── orders
                                    └── ...

                         Cloudflare R2
                         Media / Images
```

## 2. API Route Boundaries

### `/api/v1/auth/*`

Shared authentication.

Typical endpoints:

- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

### `/api/v1/platform/*`

Platform Super Admin only.

Examples:

- Store lifecycle
- Store admin management
- Global metrics
- Global visibility
- Credential/key management

### `/api/v1/admin/*`

Store Admin only.

Examples:

- Products
- Variants
- Categories
- Collections
- Inventory
- Orders
- Fulfillment
- Discounts

### `/api/v1/store/*`

Headless storefront.

Examples:

- Store details
- Published products
- Categories
- Product details
- Cart
- Checkout

## 3. Authentication Flow

```text
User
 │
 ▼
/login
 │
 │ email + password
 ▼
POST /api/v1/auth/login
 │
 ▼
Validate credentials
 │
 ▼
Load user role + store
 │
 ├── PLATFORM_SUPER_ADMIN ──► platform UI
 │
 └── STORE_ADMIN ───────────► store UI
```

The frontend must not decide privileges by hiding buttons alone. Backend middleware must enforce the role.

## 4. JWT Context

Conceptual claims:

```json
{
  "userId": "user-id",
  "role": "STORE_ADMIN",
  "storeId": "store-a-id"
}
```

Platform:

```json
{
  "userId": "platform-user-id",
  "role": "PLATFORM_SUPER_ADMIN",
  "storeId": null
}
```

## 5. Middleware Context

The request context should resolve:

- `storeId`
- `role`
- `accessType`

Allowed access types:

- `STOREFRONT`
- `STORE_ADMIN`
- `PLATFORM_ADMIN`
- `SECRET_KEY`

## 6. Storefront Key Flow

```text
Frontend
  │
  │ x-publishable-key: pk_live_store_a_...
  ▼
Storefront middleware
  │
  ▼
Find key
  │
  ▼
Resolve store A
  │
  ▼
Set currentStoreId = Store A
  │
  ▼
Store routes
  │
  ▼
Tenant-scoped queries
```

Publishable keys are client-safe and are not admin credentials.

## 7. Secret Key Flow

```text
Trusted Backend
 │
 │ Authorization: Bearer sk_live_...
 ▼
Secret-key middleware
 │
 ▼
Hash presented key
 │
 ▼
Compare SHA-256 hash
 │
 ▼
Resolve owning store
 │
 ▼
Set storeId
 │
 ▼
Allow only permitted server-to-server operations
```

Never store the raw secret key.

## 8. Tenant Isolation Rule

Every Store Admin/Storefront database operation must include the current store ID.

Safe conceptual update:

```text
UPDATE products
WHERE id = requestedId
AND store_id = currentStoreId
```

Never trust a client-supplied `storeId` to determine authorization.

## 9. Platform Admin Isolation Boundary

Platform Super Admin is the explicit global role.

Do not allow `storeId = null` to accidentally mean "all records" for normal users.

Global access must come from an explicit platform authorization guard.

## 10. Recommended Application Layers

```text
Route
  ↓
Validation
  ↓
Authentication Middleware
  ↓
Authorization Guard
  ↓
Controller/Handler
  ↓
Service / Business Logic
  ↓
Repository / Query Layer
  ↓
Drizzle
  ↓
PostgreSQL
```

## 11. Repository Safety

Prefer methods whose signatures require tenant context.

Conceptual examples:

```text
getProduct(storeId, productId)
updateProduct(storeId, productId, input)
deleteProduct(storeId, productId)
listProducts(storeId, filters)
```

This makes tenant scope difficult to forget.

## 12. Transactions

Use database transactions around operations that must succeed or fail together.

Examples:

- Checkout
- Order creation
- Inventory decrement
- Order item creation
- Inventory reservation/release

## 13. Concurrency

Inventory updates must account for concurrent checkout attempts.

Do not rely on:

```text
read stock -> calculate -> write stock
```

without protecting against concurrent requests.

## 14. Media

Store catalog/media objects in Cloudflare R2.

Database stores metadata/object keys rather than large binary content.

## 15. API Response Envelope

Success:

```json
{
  "status": "success",
  "message": "Product created successfully",
  "data": {}
}
```

Error:

```json
{
  "status": "error",
  "message": "Product not found",
  "errors": [
    {
      "code": "NOT_FOUND",
      "message": "Product not found"
    }
  ]
}
```

## 16. Pagination

All potentially large list endpoints should support pagination.

Minimum conceptual parameters:

- `page`
- `pageSize`

Response should include enough metadata for frontend pagination.

## 17. Architecture Rule

The frontend is not the security boundary.

```text
UI role check
      +
API authorization
      +
tenant-scoped DB query
```

All three should align.
