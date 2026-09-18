# Frontend Storefront — Full Implementation Prompt

Use this document as the **master prompt** when building or extending the customer-facing Next.js storefront for this monorepo. Paste it into an AI coding session or hand it to a developer as the single source of requirements.

---

## Role

You are a senior frontend engineer implementing a **modern, trendy multi-tenant e-commerce storefront** in the existing Turborepo monorepo. The backend is already built (Hono on Cloudflare Workers, PostgreSQL via Hyperdrive, Drizzle). The **admin UI already exists** in `apps/web`. Your job is to add the **customer storefront** that talks exclusively to the **`/api/v1/store/*`** API—not Shopify, not Medusa, not the Vercel Next.js Commerce template data layer.

---

## Repository context

| Path | Purpose |
|------|---------|
| `apps/api` | Hono API: `/api/v1/platform`, `/api/v1/admin`, `/api/v1/store`, `/api/v1/auth`, `/api/v1/s2s` |
| `apps/web` | Next.js 16 App Router, React 19, Tailwind 4, shadcn/ui, TanStack Query/Table |
| `.cursor/rules/architecture.mdc` | Tenancy, auth, money, secrets — **must follow** |

### What already exists in `apps/web`

- **Admin**: `/login`, `/admin/*` (platform super admin + store admin), sidebar shell, data tables, product stepper, permissions.
- **API client**: `lib/api.ts` — `{ status, message, data, pagination? }` envelope, admin JWT via `Authorization` + cookies (`access_token`, `auth_role`).
- **Money**: `lib/money.ts` — `formatPaise()` for INR integer paise display.
- **Routing guard**: `proxy.ts` — today redirects `/` to `/login` or `/admin`; **`/store/*` redirects away** (storefront not implemented yet).
- **Env**: `NEXT_PUBLIC_API_URL` (e.g. `http://127.0.0.1:8787`).

### What does NOT exist yet

- Customer-facing shop routes, layouts, and components.
- Storefront API client with `x-publishable-key`.
- Customer auth session (separate from admin cookies).
- Cart persistence and checkout UI.
- Media proxy for storefront images (publishable key required on `/store/media/:id`).

---

## Non-negotiable rules (from architecture)

1. **Tenancy**: Store is resolved by the backend from the **publishable key**. Never send a client-chosen `storeId` for authorization. Never assume `storeId = null` means global access.
2. **Storefront auth**: All `/api/v1/store/*` routes require header **`x-publishable-key: pk_live_...`** (see `apps/api/src/shared/constants/headers.ts`).
3. **Customer JWT**: Optional `Authorization: Bearer <token>` for logged-in customers (`typ: "customer"`, scoped to one `storeId`). Separate from admin JWT (`typ: "admin"`).
4. **Money**: **INR only**, **integer paise** everywhere. Use `formatPaise()` — no floats for prices or totals.
5. **Secrets**: Do not log raw keys, passwords, or full `Authorization` headers. Publishable keys may appear in server-side env; prefer server proxy for media when possible.
6. **UI is not security**: Hide actions in UI only after backend errors; backend enforces all access.

---

## Backend storefront API contract

Base path: **`{NEXT_PUBLIC_API_URL}/api/v1/store`**

Every request must include:

```http
x-publishable-key: pk_live_<your_store_key>
```

Customer-authenticated requests additionally include:

```http
Authorization: Bearer <customer_access_token>
```

Checkout (and other idempotent flows) may include:

```http
idempotency-key: <uuid>
```

### Endpoints (implement UI against these)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/details` | Store name, slug, status, domain, contact, currency, timezone, shipping, tax |
| GET | `/products` | Catalog list (pagination + filters) |
| GET | `/products/:handle` | PDP: product, active variants + stock, images |
| GET | `/media/:mediaId` | Binary/stream media (requires publishable key) |
| GET | `/categories` | List categories |
| GET | `/categories/:slug` | Category + products |
| GET | `/collections` | List collections |
| GET | `/collections/:slug` | Collection detail |
| POST | `/carts` | Create cart (optional customer if logged in) |
| GET | `/carts/:cartId` | Cart with computed tax/shipping/grand total |
| POST | `/carts/:cartId/email` | Set guest email on cart |
| POST | `/carts/:cartId/customer` | Attach logged-in customer to cart |
| POST | `/carts/:cartId/items` | Add line `{ variantId, quantity }` |
| PATCH | `/carts/:cartId/items/:itemId` | Update quantity |
| DELETE | `/carts/:cartId/items/:itemId` | Remove line |
| POST | `/carts/:cartId/discount` | Apply discount code |
| POST | `/carts/:cartId/shipping-address` | Set shipping address on cart |
| POST | `/carts/:cartId/shipping-address/from-saved` | Use saved customer address |
| POST | `/carts/:cartId/checkout` | Place order `{ email?, discountCode? }` + idempotency header |
| POST | `/auth/register` | Customer register |
| POST | `/auth/login` | Customer login → `accessToken` |
| GET | `/auth/me` | Current customer (Bearer required) |
| GET | `/orders` | Customer order list |
| GET | `/orders/lookup` | Guest lookup by `orderNumber` + `email` |
| GET | `/orders/:orderId` | Order detail |
| POST | `/orders/:orderId/return` | Request return |
| GET/POST/PATCH/DELETE | `/addresses` | Saved addresses CRUD |

### Product list query params (`GET /products`)

- Pagination: `page`, `pageSize` (defaults align with API: page 1, size 20, max 100)
- `categoryId`, `collectionId`, `q` (search)
- `sort`: `created_at_desc` | `price_asc` | `price_desc`
- `inStock`: `true` | `false`
- `minPricePaise`, `maxPricePaise`

### Response shape

Same as admin client:

```ts
type ApiSuccessResponse<T> = {
  status: "success"
  message: string
  data: T
  pagination?: { page: number; pageSize: number; total: number; totalPages: number }
}

type ApiErrorResponse = {
  status: "error"
  message: string
  errors?: Array<{ code: string; message?: string; details?: unknown }>
}
```

Reuse `ApiError` pattern from `lib/api.ts`. Optional response header: `x-request-id`.

### Cart presentation

API returns cart with **computed** `taxTotalPaise`, `shippingTotalPaise`, `grandTotalPaise`, `gstPercent` based on store commerce settings. Display these; do not recalculate tax/shipping on the client.

### Checkout behavior

- Requires non-empty cart, shipping address fields on cart, and **email** (body or cart or customer).
- Creates order with status **`PENDING`**, currency **`INR`**. There is **no payment gateway** in v1 — UI should say order placed / pay offline / awaiting confirmation as appropriate.
- Use **`idempotency-key`** on checkout to prevent double-submit duplicates.

### Media URLs

List/detail product responses expose image `src` like `/api/v1/store/media/{id}` (relative to API host). Browsers cannot attach `x-publishable-key` on plain `<img src>`. **Implement a Next.js Route Handler** (e.g. `app/api/store-media/[mediaId]/route.ts`) that proxies to the Worker with the publishable key server-side, and point `next/image` or components at that path.

---

## Sample requests & responses

All examples assume:

```text
Base URL: http://127.0.0.1:8787/api/v1/store
x-publishable-key: pk_live_examplekey123
```

UUIDs and timestamps are illustrative. Money fields are **integer paise** (`199900` = ₹1,999.00).

### Common error responses

**Missing / invalid publishable key** — `401`

```http
GET /api/v1/store/details
```

```json
{
  "status": "error",
  "message": "Invalid API key.",
  "errors": [{ "code": "INVALID_API_KEY", "message": "Invalid API key." }]
}
```

**Validation error** — `400`

```json
{
  "status": "error",
  "message": "Invalid cart item.",
  "errors": [
    {
      "code": "VALIDATION_ERROR",
      "message": "Invalid cart item.",
      "details": { "formErrors": [], "fieldErrors": { "quantity": ["Required"] } }
    }
  ]
}
```

**Insufficient stock** — typically `409` / app error with code `INSUFFICIENT_STOCK`

```json
{
  "status": "error",
  "message": "Insufficient stock.",
  "errors": [{ "code": "INSUFFICIENT_STOCK", "message": "Insufficient stock." }]
}
```

**Unauthorized customer** — `401` (`UNAUTHORIZED`) when Bearer missing/invalid for protected routes.

---

### `GET /details` — store bootstrap

**Request**

```http
GET /api/v1/store/details
x-publishable-key: pk_live_examplekey123
```

**Response** — `200`

```json
{
  "status": "success",
  "message": "Store retrieved.",
  "data": {
    "id": "11111111-1111-1111-1111-111111111111",
    "name": "Acme Home",
    "slug": "acme-home",
    "status": "ACTIVE",
    "domain": "shop.acme.test",
    "contactEmail": "hello@acme.test",
    "currency": "INR",
    "timezone": "Asia/Kolkata",
    "shipping": {
      "mode": "flat",
      "flatPaise": 4900,
      "freeOverPaise": null
    },
    "tax": {
      "gstPercent": 18,
      "gstin": "29AAAAA0000A1Z5"
    }
  }
}
```

`shipping.mode`: `"flat"` | `"free_over"` | `"off"`.

---

### `GET /products` — product list (PLP)

**Request**

```http
GET /api/v1/store/products?page=1&pageSize=20&q=mug&sort=price_asc&inStock=true&minPricePaise=10000&maxPricePaise=500000
x-publishable-key: pk_live_examplekey123
```

Optional filters: `categoryId`, `collectionId` (UUIDs).

**Response** — `200`

```json
{
  "status": "success",
  "message": "Products retrieved.",
  "data": [
    {
      "id": "22222222-2222-2222-2222-222222222222",
      "storeId": "11111111-1111-1111-1111-111111111111",
      "categoryId": "33333333-3333-3333-3333-333333333333",
      "title": "Ceramic Mug",
      "handle": "ceramic-mug",
      "shortDescription": "Everyday stoneware mug",
      "description": "Hand-glazed ceramic mug. Microwave safe.",
      "status": "ACTIVE",
      "createdAt": "2026-03-01T10:00:00.000Z",
      "updatedAt": "2026-03-10T12:00:00.000Z",
      "minPricePaise": 49900,
      "maxPricePaise": 69900,
      "compareAtPricePaise": 79900,
      "inStock": true,
      "thumbnail": {
        "id": "aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
        "altText": "Ceramic mug front",
        "src": "/api/v1/store/media/aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

`thumbnail` may be `null`. Image `src` is **API-relative** — rewrite via your Next media proxy.

---

### `GET /products/:handle` — product detail (PDP)

**Request**

```http
GET /api/v1/store/products/ceramic-mug
x-publishable-key: pk_live_examplekey123
```

**Response** — `200`

```json
{
  "status": "success",
  "message": "Product retrieved.",
  "data": {
    "id": "22222222-2222-2222-2222-222222222222",
    "storeId": "11111111-1111-1111-1111-111111111111",
    "categoryId": "33333333-3333-3333-3333-333333333333",
    "title": "Ceramic Mug",
    "handle": "ceramic-mug",
    "shortDescription": "Everyday stoneware mug",
    "description": "Hand-glazed ceramic mug. Microwave safe.",
    "status": "ACTIVE",
    "createdAt": "2026-03-01T10:00:00.000Z",
    "updatedAt": "2026-03-10T12:00:00.000Z",
    "variants": [
      {
        "id": "44444444-4444-4444-4444-444444444444",
        "storeId": "11111111-1111-1111-1111-111111111111",
        "productId": "22222222-2222-2222-2222-222222222222",
        "sku": "MUG-WHITE",
        "title": "White / 350ml",
        "pricePaise": 49900,
        "compareAtPricePaise": 59900,
        "status": "ACTIVE",
        "availableQuantity": 12,
        "inStock": true,
        "createdAt": "2026-03-01T10:05:00.000Z",
        "updatedAt": "2026-03-10T12:00:00.000Z"
      }
    ],
    "images": [
      {
        "id": "aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
        "storeId": "11111111-1111-1111-1111-111111111111",
        "productId": "22222222-2222-2222-2222-222222222222",
        "storageKey": "stores/.../mug-1.jpg",
        "url": null,
        "altText": "Ceramic mug front",
        "sortOrder": 0,
        "isThumbnail": true,
        "createdAt": "2026-03-01T10:06:00.000Z",
        "updatedAt": "2026-03-01T10:06:00.000Z",
        "src": "/api/v1/store/media/aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1"
      }
    ],
    "thumbnail": {
      "id": "aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
      "altText": "Ceramic mug front",
      "src": "/api/v1/store/media/aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1"
    }
  }
}
```

Only **ACTIVE** variants are returned. Use `variant.id` when adding to cart.

---

### `GET /media/:mediaId` — image bytes

**Request**

```http
GET /api/v1/store/media/aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1
x-publishable-key: pk_live_examplekey123
```

**Response** — `200` (not JSON)

```http
Content-Type: image/jpeg
Cache-Control: public, max-age=3600

<binary body>
```

Frontend must proxy this; never put `pk_live_` in public HTML.

---

### `GET /categories` / `GET /categories/:slug`

**List request**

```http
GET /api/v1/store/categories
x-publishable-key: pk_live_examplekey123
```

**List response** — `200`

```json
{
  "status": "success",
  "message": "Categories retrieved.",
  "data": [
    {
      "id": "33333333-3333-3333-3333-333333333333",
      "storeId": "11111111-1111-1111-1111-111111111111",
      "name": "Drinkware",
      "slug": "drinkware",
      "parentId": null,
      "status": "ACTIVE",
      "createdAt": "2026-02-01T08:00:00.000Z",
      "updatedAt": "2026-02-01T08:00:00.000Z"
    }
  ]
}
```

**Detail request**

```http
GET /api/v1/store/categories/drinkware
x-publishable-key: pk_live_examplekey123
```

**Detail response** — `200` — category fields + `products` array (same catalog shape as PLP items, including `thumbnail`, pricing, `inStock`). Up to 100 products.

```json
{
  "status": "success",
  "message": "Category retrieved.",
  "data": {
    "id": "33333333-3333-3333-3333-333333333333",
    "storeId": "11111111-1111-1111-1111-111111111111",
    "name": "Drinkware",
    "slug": "drinkware",
    "parentId": null,
    "status": "ACTIVE",
    "createdAt": "2026-02-01T08:00:00.000Z",
    "updatedAt": "2026-02-01T08:00:00.000Z",
    "products": [
      {
        "id": "22222222-2222-2222-2222-222222222222",
        "title": "Ceramic Mug",
        "handle": "ceramic-mug",
        "minPricePaise": 49900,
        "maxPricePaise": 69900,
        "compareAtPricePaise": 79900,
        "inStock": true,
        "thumbnail": {
          "id": "aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
          "altText": "Ceramic mug front",
          "src": "/api/v1/store/media/aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1"
        }
      }
    ]
  }
}
```

---

### `GET /collections` / `GET /collections/:slug`

**List** — same pattern as categories; fields: `id`, `storeId`, `name`, `slug`, `description`, `status`, timestamps.

**Detail** — `GET /collections/new-arrivals` returns collection + nested `products` (ACTIVE only). Nested products include relation `variants` and `images` as DB rows. Prefer building image URLs as `/api/v1/store/media/{image.id}` (this endpoint may not attach the rewritten `src` field like PLP/PDP).

---

### Cart lifecycle

#### `POST /carts` — create cart

**Request**

```http
POST /api/v1/store/carts
x-publishable-key: pk_live_examplekey123
Authorization: Bearer <optional_customer_jwt>
Content-Type: application/json
```

(No body required. If Bearer customer JWT is present, cart is linked to that customer.)

**Response** — `201`

```json
{
  "status": "success",
  "message": "Cart created.",
  "data": {
    "id": "55555555-5555-5555-5555-555555555555",
    "storeId": "11111111-1111-1111-1111-111111111111",
    "customerId": null,
    "email": null,
    "status": "ACTIVE",
    "shippingName": null,
    "shippingPhone": null,
    "shippingAddressLine1": null,
    "shippingAddressLine2": null,
    "shippingCity": null,
    "shippingState": null,
    "shippingPostalCode": null,
    "shippingCountry": null,
    "subtotalPaise": 0,
    "discountCode": null,
    "discountTotalPaise": 0,
    "createdAt": "2026-03-15T09:00:00.000Z",
    "updatedAt": "2026-03-15T09:00:00.000Z",
    "items": [],
    "taxTotalPaise": 0,
    "shippingTotalPaise": 0,
    "grandTotalPaise": 0,
    "gstPercent": 18
  }
}
```

Persist `data.id` as `cart_id` cookie.

#### `GET /carts/:cartId`

Same presented cart shape as above (with items when present).

#### `POST /carts/:cartId/items` — add line

**Request**

```http
POST /api/v1/store/carts/55555555-5555-5555-5555-555555555555/items
x-publishable-key: pk_live_examplekey123
Content-Type: application/json

{
  "variantId": "44444444-4444-4444-4444-444444444444",
  "quantity": 2
}
```

**Response** — `200` (full presented cart)

```json
{
  "status": "success",
  "message": "Cart item added.",
  "data": {
    "id": "55555555-5555-5555-5555-555555555555",
    "storeId": "11111111-1111-1111-1111-111111111111",
    "customerId": null,
    "email": null,
    "status": "ACTIVE",
    "subtotalPaise": 99800,
    "discountCode": null,
    "discountTotalPaise": 0,
    "items": [
      {
        "id": "66666666-6666-6666-6666-666666666666",
        "storeId": "11111111-1111-1111-1111-111111111111",
        "cartId": "55555555-5555-5555-5555-555555555555",
        "variantId": "44444444-4444-4444-4444-444444444444",
        "quantity": 2,
        "unitPricePaise": 49900,
        "createdAt": "2026-03-15T09:01:00.000Z",
        "updatedAt": "2026-03-15T09:01:00.000Z"
      }
    ],
    "taxTotalPaise": 17064,
    "shippingTotalPaise": 4900,
    "grandTotalPaise": 121764,
    "gstPercent": 18,
    "shippingName": null,
    "shippingPhone": null,
    "shippingAddressLine1": null,
    "shippingAddressLine2": null,
    "shippingCity": null,
    "shippingState": null,
    "shippingPostalCode": null,
    "shippingCountry": null,
    "createdAt": "2026-03-15T09:00:00.000Z",
    "updatedAt": "2026-03-15T09:01:00.000Z"
  }
}
```

Line items do **not** include product title/image — join from PDP cache or fetch product by handle for UI labels.

#### `PATCH /carts/:cartId/items/:itemId`

```json
{ "quantity": 3 }
```

Returns full presented cart (`CART_ITEM_UPDATED`).

#### `DELETE /carts/:cartId/items/:itemId`

No body. Returns full presented cart (`CART_ITEM_REMOVED`).

#### `POST /carts/:cartId/email`

```json
{ "email": "guest@example.com" }
```

Returns presented cart.

#### `POST /carts/:cartId/customer` — merge guest cart after login

```http
POST /api/v1/store/carts/{cartId}/customer
x-publishable-key: pk_live_examplekey123
Authorization: Bearer <customer_jwt>
```

No body. Returns presented cart with `customerId` set.

#### `POST /carts/:cartId/discount`

Apply:

```json
{ "code": "WELCOME10" }
```

Remove:

```json
{ "code": null }
```

Returns presented cart with `discountCode` / `discountTotalPaise` updated.

#### `POST /carts/:cartId/shipping-address`

**Request body**

```json
{
  "name": "Dharani Kumar",
  "phone": "9876543210",
  "addressLine1": "12 MG Road",
  "addressLine2": "Near Metro",
  "city": "Bengaluru",
  "state": "KA",
  "postalCode": "560001",
  "country": "IN"
}
```

`country` defaults to `"IN"` if omitted in schema default. Returns presented cart with shipping fields set.

#### `POST /carts/:cartId/shipping-address/from-saved` (customer JWT required)

```json
{ "addressId": "77777777-7777-7777-7777-777777777777" }
```

#### `POST /carts/:cartId/checkout` — place order

**Request**

```http
POST /api/v1/store/carts/55555555-5555-5555-5555-555555555555/checkout
x-publishable-key: pk_live_examplekey123
Authorization: Bearer <optional_customer_jwt>
Content-Type: application/json
idempotency-key: 9f8e7d6c-5b4a-3210-9876-543210fedcba

{
  "email": "guest@example.com",
  "discountCode": "WELCOME10"
}
```

`email` and `discountCode` are optional if already on the cart. Shipping address must already be on the cart.

**Response** — `201`

```json
{
  "status": "success",
  "message": "Order created.",
  "data": {
    "id": "88888888-8888-8888-8888-888888888888",
    "storeId": "11111111-1111-1111-1111-111111111111",
    "orderNumber": "ORD-1710500000000",
    "customerId": null,
    "email": "guest@example.com",
    "status": "PENDING",
    "idempotencyKey": "9f8e7d6c-5b4a-3210-9876-543210fedcba",
    "subtotalPaise": 99800,
    "discountCode": "WELCOME10",
    "discountTotalPaise": 9980,
    "taxTotalPaise": 16168,
    "shippingTotalPaise": 4900,
    "grandTotalPaise": 110888,
    "currency": "INR",
    "shippingName": "Dharani Kumar",
    "shippingPhone": "9876543210",
    "shippingAddressLine1": "12 MG Road",
    "shippingAddressLine2": "Near Metro",
    "shippingCity": "Bengaluru",
    "shippingState": "KA",
    "shippingPostalCode": "560001",
    "shippingCountry": "IN",
    "trackingNumber": null,
    "carrier": null,
    "adminNote": null,
    "createdAt": "2026-03-15T09:10:00.000Z",
    "updatedAt": "2026-03-15T09:10:00.000Z",
    "items": [
      {
        "id": "99999999-9999-9999-9999-999999999999",
        "storeId": "11111111-1111-1111-1111-111111111111",
        "orderId": "88888888-8888-8888-8888-888888888888",
        "productId": "22222222-2222-2222-2222-222222222222",
        "variantId": "44444444-4444-4444-4444-444444444444",
        "productTitle": "White / 350ml",
        "variantTitle": "White / 350ml",
        "sku": "MUG-WHITE",
        "unitPricePaise": 49900,
        "quantity": 2,
        "lineTotalPaise": 99800,
        "createdAt": "2026-03-15T09:10:00.000Z",
        "updatedAt": "2026-03-15T09:10:00.000Z"
      }
    ]
  }
}
```

Same `idempotency-key` replay returns the existing order (`ORDER_RETRIEVED`, `200`). Cart becomes `CHECKED_OUT` — create a new cart for the next session.

---

### Customer auth

#### `POST /auth/register` — `201`

**Request**

```json
{
  "email": "buyer@example.com",
  "password": "secretpass",
  "name": "Dharani",
  "phone": "9876543210"
}
```

`password` min length **8**. `phone` optional.

**Response**

```json
{
  "status": "success",
  "message": "Customer registered.",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "customer": {
      "id": "abababab-abab-abab-abab-abababababab",
      "email": "buyer@example.com",
      "name": "Dharani",
      "storeId": "11111111-1111-1111-1111-111111111111"
    }
  }
}
```

Store `accessToken` in **customer** cookie (not admin `access_token`).

#### `POST /auth/login` — `200`

**Request**

```json
{
  "email": "buyer@example.com",
  "password": "secretpass"
}
```

**Response** — same shape as register (`CUSTOMER_LOGGED_IN`).

#### `GET /auth/me` — customer JWT required

```http
GET /api/v1/store/auth/me
x-publishable-key: pk_live_examplekey123
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** — `200`

```json
{
  "status": "success",
  "message": "Customer retrieved.",
  "data": {
    "id": "abababab-abab-abab-abab-abababababab",
    "email": "buyer@example.com",
    "name": "Dharani",
    "storeId": "11111111-1111-1111-1111-111111111111"
  }
}
```

---

### Orders (account + guest)

#### `GET /orders` — customer JWT required

Returns array of order rows (no nested items). Use for account order list.

#### `GET /orders/:orderId` — customer JWT required

Returns order + `items` + `returns` (newest first).

#### `GET /orders/lookup` — guest track

**Request**

```http
GET /api/v1/store/orders/lookup?orderNumber=ORD-1710500000000&email=guest@example.com
x-publishable-key: pk_live_examplekey123
```

**Response** — `200` — order with `items` and `returns` (same detail shape).

#### `POST /orders/:orderId/return` — customer JWT required

**Request**

```json
{ "reason": "Damaged on arrival" }
```

`reason` length 3–1000. Order must be in a returnable status.

**Response** — `201`

```json
{
  "status": "success",
  "message": "Return requested.",
  "data": {
    "id": "cccccccc-cccc-cccc-cccc-cccccccccccc",
    "storeId": "11111111-1111-1111-1111-111111111111",
    "orderId": "88888888-8888-8888-8888-888888888888",
    "customerId": "abababab-abab-abab-abab-abababababab",
    "status": "REQUESTED",
    "reason": "Damaged on arrival",
    "decisionNote": null,
    "decidedAt": null,
    "createdAt": "2026-03-16T11:00:00.000Z",
    "updatedAt": "2026-03-16T11:00:00.000Z"
  }
}
```

---

### Addresses (customer JWT required)

#### `GET /addresses`

```json
{
  "status": "success",
  "message": "Addresses retrieved.",
  "data": [
    {
      "id": "77777777-7777-7777-7777-777777777777",
      "storeId": "11111111-1111-1111-1111-111111111111",
      "customerId": "abababab-abab-abab-abab-abababababab",
      "name": "Dharani Kumar",
      "phone": "9876543210",
      "addressLine1": "12 MG Road",
      "addressLine2": "Near Metro",
      "city": "Bengaluru",
      "state": "KA",
      "postalCode": "560001",
      "country": "IN",
      "isDefault": true,
      "createdAt": "2026-03-10T08:00:00.000Z",
      "updatedAt": "2026-03-10T08:00:00.000Z"
    }
  ]
}
```

#### `POST /addresses` — `201`

```json
{
  "name": "Dharani Kumar",
  "phone": "9876543210",
  "addressLine1": "12 MG Road",
  "addressLine2": "Near Metro",
  "city": "Bengaluru",
  "state": "KA",
  "postalCode": "560001",
  "country": "IN",
  "isDefault": true
}
```

#### `PATCH /addresses/:addressId`

Partial body (same fields optional). Returns updated address.

#### `DELETE /addresses/:addressId`

```json
{
  "status": "success",
  "message": "Address deleted.",
  "data": { "deleted": true }
}
```

---

### Frontend typing hints (recommended)

```ts
type MoneyPaise = number // integer only

type StoreDetails = {
  id: string
  name: string
  slug: string
  status: string
  domain: string | null
  contactEmail: string | null
  currency: string // "INR"
  timezone: string
  shipping: { mode: "flat" | "free_over" | "off"; flatPaise: number; freeOverPaise: number | null }
  tax: { gstPercent: number; gstin: string | null }
}

type CatalogProduct = {
  id: string
  storeId: string
  categoryId: string | null
  title: string
  handle: string
  shortDescription: string | null
  description: string | null
  status: "ACTIVE" | "DRAFT" | "ARCHIVED"
  createdAt: string
  updatedAt: string
  minPricePaise: number | null
  maxPricePaise: number | null
  compareAtPricePaise: number | null
  inStock: boolean
  thumbnail: { id: string; altText: string | null; src: string } | null
}

type PresentedCart = {
  id: string
  storeId: string
  customerId: string | null
  email: string | null
  status: "ACTIVE" | "CHECKED_OUT" | string
  items: Array<{
    id: string
    cartId: string
    variantId: string
    quantity: number
    unitPricePaise: number
  }>
  subtotalPaise: number
  discountCode: string | null
  discountTotalPaise: number
  taxTotalPaise: number
  shippingTotalPaise: number
  grandTotalPaise: number
  gstPercent: number
  // + shipping* fields
}
```

---

## Multi-tenant resolution (frontend)

**Phase 1 (development):**

- Env: `STORE_PUBLISHABLE_KEY=pk_live_...` (server) and/or `NEXT_PUBLIC_STORE_PUBLISHABLE_KEY` only if you accept key in client fetch (prefer server-side key injection via Route Handlers / Server Components).

**Phase 2 (production):**

- Resolve tenant from **`Host`** header: custom domain or `{slug}.shops.example.com`.
- Map host → publishable key via server-only config or secure platform lookup — **never** `?storeId=` from the URL for auth.
- Optional: read `domain` from `GET /store/details` after key resolution for canonical URLs.

**Admin vs shop hosts:**

- `admin.example.com` → existing `/login`, `/admin/*` behavior.
- `shop.example.com` or store custom domain → storefront `(shop)` routes at `/`, not redirect to admin.

Update `proxy.ts` (or middleware) accordingly: do not send storefront visitors to `/login`.

---

## Auth model (storefront)

| Actor | Cookie / storage | API |
|-------|------------------|-----|
| Admin | `access_token`, `auth_role` | `/api/v1/auth/*`, `/admin`, `/platform` |
| Customer | **Separate** e.g. `customer_access_token` (httpOnly preferred) | `/api/v1/store/auth/*` + Bearer on store routes |
| Guest cart | **httpOnly** `cart_id` cookie | Store routes with publishable key only |

Rules:

- Customer login must **not** overwrite admin session cookies or vice versa.
- On customer login, optionally call `POST /carts/:cartId/customer` to merge guest cart.
- Logout clears customer cookies only.

---

## Technical implementation requirements

### Stack (match existing)

- Next.js **16** App Router, **Turbopack** for dev/build
- TypeScript strict
- Tailwind **4**, shadcn/ui components already in `components/ui`
- TanStack Query for client cart, account, mutations
- Zod for form validation where helpful
- `sonner` toasts — reuse `lib/toast.ts` patterns; storefront may use subtler toasts than admin

### Code organization

Extend `apps/web` (do not create a second app unless explicitly requested):

```text
app/
  (shop)/                    # Route group — storefront
    layout.tsx               # Shop header/footer, fonts, ShopProvider
    page.tsx                 # Home
    products/page.tsx        # PLP
    products/[handle]/page.tsx
    categories/[slug]/page.tsx
    collections/[slug]/page.tsx
    cart/page.tsx
    checkout/page.tsx
    order/confirmation/page.tsx
    order/track/page.tsx
    account/
      login/page.tsx
      register/page.tsx
      page.tsx               # Account home
      orders/page.tsx
      orders/[id]/page.tsx
      addresses/page.tsx
  admin/                     # Existing — unchanged
  login/                     # Admin login — unchanged
app/api/store-media/[mediaId]/route.ts   # Media proxy

components/
  shop/                      # Storefront-only components
    header.tsx
    footer.tsx
    product-card.tsx
    product-grid.tsx
    filter-bar.tsx
    variant-selector.tsx
    cart-drawer.tsx
    order-summary.tsx
    address-form.tsx
    price.tsx

lib/
  api/storefront/
    client.ts                # storefrontFetch, storefrontFetchList
    store.ts
    products.ts
    categories.ts
    collections.ts
    cart.ts
    checkout.ts
    auth.ts
    orders.ts
    addresses.ts
  shop/
    tenant.ts                # resolve publishable key (server)
    cart-cookie.ts
    customer-auth-cookie.ts
    constants.ts
```

### API client (`storefrontFetch`)

- Mirror `lib/api.ts`: same envelope parsing, `ApiError`, `toQueryString`, list helper with pagination.
- Always attach `x-publishable-key` from server context or env.
- Auth mode: `"publishable"` | `"customer"` | `"none"` (none still sends publishable key).
- Server Components: use async functions that read tenant key via `lib/shop/tenant.ts` — no browser exposure required.

### Data fetching

| Surface | Pattern |
|---------|---------|
| Home, PLP, PDP, category, collection | **Server Components** + fetch with revalidate (e.g. 60s) or tags later |
| Cart, add to cart, checkout | **Client** + TanStack Query; optimistic updates on line quantity |
| Account | Client + Query; protect routes with customer session check |

### Routing & SEO

- PDP URL: `/products/[handle]` (kebab-case handles from API).
- PLP filters in **URL search params** (`?q=&sort=&page=`) for shareable links.
- `generateMetadata` on PDP/PLP using product/store titles.
- Optional: JSON-LD Product on PDP.

---

## UX / visual design — modern & trendy

The admin app is **dense and operational**. The storefront must feel **editorial, spacious, and premium** — not the same sidebar dashboard aesthetic.

### Design principles

1. **Typography**: Use a distinct shop font stack in `(shop)/layout.tsx` only — e.g. display serif for headings (Instrument Serif / Fraunces) + clean sans for UI (Geist Sans or keep Inter). Admin stays on Inter.
2. **Layout**: Large imagery, generous whitespace, subtle 1px borders, limited heavy card chrome.
3. **Color**: Neutral base (stone/zinc) + one accent; prepare CSS variables for per-store theming later.
4. **Motion**: Restrained — cart drawer (Sheet), PLP→PDP view transitions if enabled, hover scale on product tiles. No excessive parallax.
5. **Mobile-first**: Bottom nav or compact header; filter **sheet** on mobile; sticky **Add to bag** on PDP.

### Required UX patterns

- Global header: logo/store name, search entry, cart icon with count, account link.
- **Cart drawer** (Sheet) + full `/cart` page.
- PLP: grid/list toggle optional; sort dropdown; filters (category, price range in rupees → convert to paise for API, in stock).
- PDP: image gallery (main + thumbnails), variant buttons, stock indicator, quantity stepper, add to cart.
- Checkout: stepped sections on one page — contact email → shipping address (India: line1, city, state, PIN, phone) → order review → place order.
- Order confirmation: order number, line items, totals breakdown (subtotal, discount, GST, shipping, grand total).
- Guest **Track order** page using `/orders/lookup`.
- Account: orders list, order detail, addresses, return request where API allows.
- Loading: shadcn `Skeleton` matching layout; empty states with clear CTAs.

### Accessibility

- Focus traps in drawer/dialog, keyboard variant selection, visible focus rings, alt text from API `altText`.

---

## Environment variables

```env
# Existing
NEXT_PUBLIC_API_URL=http://127.0.0.1:8787

# Storefront (add to .env.example)
STORE_PUBLISHABLE_KEY=pk_live_...
# Optional dev-only if client-side fetch must attach key directly (avoid if possible):
# NEXT_PUBLIC_STORE_PUBLISHABLE_KEY=pk_live_...

# Optional multi-tenant map (JSON server-only) host -> pk_live_...
# STORE_TENANT_KEYS={"localhost":"pk_live_...","acme.local":"pk_live_..."}
```

Document all new vars in `apps/web/.env.example`.

---

## Middleware / proxy changes

1. Detect **admin host** vs **shop host** (env flag `APP_MODE=admin|shop` or host allowlist).
2. Shop host: `/` → storefront home, **not** `/login`.
3. Keep `/admin/*` and `/login` for admin host or path-based split (`/admin` only on admin deployment).
4. Do not break existing platform/store admin flows.

---

## Phased delivery (implement in order)

### Phase 0 — Foundation

- [ ] `lib/api/storefront/client.ts` + tenant resolution
- [ ] Media proxy route
- [ ] `(shop)/layout.tsx` shell (header/footer)
- [ ] Proxy/middleware split for shop vs admin
- [ ] `.env.example` updates

### Phase 1 — Catalog

- [ ] Home (featured collections/products from API)
- [ ] PLP with filters, sort, pagination
- [ ] PDP with variants, stock, gallery
- [ ] Category and collection pages

### Phase 2 — Cart

- [ ] Create/load cart cookie
- [ ] Add/update/remove lines
- [ ] Cart drawer + `/cart` page
- [ ] Discount code application

### Phase 3 — Checkout & orders

- [ ] Shipping address on cart
- [ ] Checkout with idempotency
- [ ] Confirmation page
- [ ] Guest order lookup

### Phase 4 — Account

- [ ] Register / login / logout (customer cookies)
- [ ] Merge cart on login
- [ ] Orders + addresses + returns

### Phase 5 — Polish

- [ ] Performance (LCP, `next/image` via proxy)
- [ ] Error boundaries and friendly API error messages
- [ ] Dark mode optional for shop
- [ ] Cache revalidation hooks when admin publishes products (future)

---

## Acceptance criteria

1. End-to-end guest flow: browse → add to cart → checkout → see confirmation with **INR paise** totals matching API.
2. Logged-in customer: login → see orders and saved addresses; checkout can use saved address endpoint.
3. All store API calls include valid **`x-publishable-key`**; no unauthorized cross-store data.
4. Admin app at `/admin` still works unchanged for store/platform admins.
5. No floating-point money; all prices use **`formatPaise`** or integer paise internally.
6. Product images load through **proxy** without exposing key in HTML.
7. `pnpm` / monorepo scripts: `typecheck` and `lint` pass in `apps/web`.

---

## Explicit do NOTs

- Do not integrate Shopify, Medusa, or Stripe unless backend adds payment routes.
- Do not reuse admin `access_token` for customer `/store/auth/me`.
- Do not copy Vercel Next.js Commerce env vars or their cart/checkout APIs.
- Do not authorize by query param `storeId`.
- Do not recalculate GST/shipping with floating math — trust API cart/checkout totals.
- Do not over-engineer: no separate design system package; extend existing shadcn setup.

---

## Reference files (read before coding)

- `apps/api/src/routes/v1/storefront.ts` — full store route behavior
- `apps/api/src/middleware/require-storefront.ts` — publishable key validation
- `apps/api/src/modules/product/product.schemas.ts` — `listStorefrontProductsQuerySchema`
- `apps/web/lib/api.ts` — admin fetch patterns to mirror
- `apps/web/lib/money.ts` — INR formatting
- `apps/web/proxy.ts` — current redirects to update
- `.cursor/rules/architecture.mdc` — tenancy and security

---

## Copy-paste starter prompt (short)

```text
Build the customer storefront in apps/web per docs/frontend-storefront-prompt.md.
Use the Sample requests & responses section as the API contract for typing and UI.
Use /api/v1/store with x-publishable-key, separate customer auth from admin,
implement (shop) routes, media proxy, modern editorial UI with shadcn/Tailwind 4,
INR paise via formatPaise, cart cookie + checkout with idempotency-key.
Do not break existing /admin. Follow .cursor/rules/architecture.mdc.
Start with Phase 0 and Phase 1, then stop for review.
```

---

*Last aligned with backend routes in `apps/api/src/routes/v1/storefront.ts` and admin web in `apps/web`. Sample payloads mirror live route handlers (illustrative UUIDs/messages).*
