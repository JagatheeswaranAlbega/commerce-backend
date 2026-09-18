# Storefront API Reference

Base URL: `/api/v1/store`

All money values are **integer paise** (INR). Do not send or expect floating-point rupees.

---

## Authentication

| Header | Required | Description |
|--------|----------|-------------|
| `x-publishable-key` | Always | Store publishable key (`pk_live_...`). Resolves tenant `storeId`. |
| `Authorization: Bearer <token>` | Customer routes | Customer JWT from register/login. |
| `Idempotency-Key` | Optional on checkout | Same key returns the same order if already created. |
| `Content-Type: application/json` | JSON bodies | Required for POST/PATCH with a body. |

Never send a client `storeId` for authorization. Scope always comes from the publishable key (and customer token when present).

---

## Envelope

### Success

```json
{
  "status": "success",
  "message": "Human-readable summary",
  "data": {},
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

`pagination` is present only on paginated list endpoints.

### Error

```json
{
  "status": "error",
  "message": "Reason",
  "errors": [
    {
      "code": "VALIDATION_ERROR",
      "message": "Optional detail",
      "details": {}
    }
  ]
}
```

### Media (exception)

`GET /store/media/:mediaId` returns the **raw image bytes**, not the JSON envelope. Response headers include `Content-Type` and `Cache-Control`.

---

## Shared shapes

### Product (catalog list / detail base)

```ts
{
  id: string;                 // uuid
  storeId: string;
  categoryId: string | null;
  title: string;
  handle: string;             // kebab-case slug
  shortDescription: string | null;
  description: string | null;
  status: "ACTIVE";           // storefront only exposes active catalog products
  createdAt: string;          // ISO-8601
  updatedAt: string;
}
```

### Thumbnail

```ts
{
  id: string;
  altText: string | null;
  src: string;                // e.g. "/api/v1/store/media/<id>"
} | null
```

### Variant (product detail)

```ts
{
  id: string;
  storeId: string;
  productId: string;
  sku: string;
  title: string;
  pricePaise: number;
  compareAtPricePaise: number | null;
  status: "ACTIVE";
  availableQuantity: number;
  inStock: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### Product image (product detail)

```ts
{
  id: string;
  storeId: string;
  productId: string;
  storageKey: string;
  url: string | null;
  altText: string | null;
  sortOrder: number;
  isThumbnail: boolean;
  createdAt: string;
  updatedAt: string;
  src: string;                // "/api/v1/store/media/<id>"
}
```

### Cart

```ts
{
  id: string;
  storeId: string;
  customerId: string | null;
  email: string | null;
  status: "ACTIVE" | "CHECKED_OUT" | "ABANDONED";
  shippingName: string | null;
  shippingPhone: string | null;
  shippingAddressLine1: string | null;
  shippingAddressLine2: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingPostalCode: string | null;
  shippingCountry: string | null;
  subtotalPaise: number;
  discountCode: string | null;
  discountTotalPaise: number;
  taxTotalPaise: number;       // GST percent of (subtotal − discount) from store tax settings; 0 when cart empty
  shippingTotalPaise: number;  // from store shipping settings when cart has items; else 0
  grandTotalPaise: number;     // taxable + tax + shipping
  gstPercent?: number;         // effective GST % used for estimate
  createdAt: string;
  updatedAt: string;
  items: CartLineItem[];
}
```

### Cart line item

```ts
{
  id: string;
  storeId: string;
  cartId: string;
  variantId: string;
  quantity: number;
  unitPricePaise: number;
  createdAt: string;
  updatedAt: string;
}
```

### Order

```ts
{
  id: string;
  storeId: string;
  orderNumber: string;
  customerId: string | null;
  email: string | null;
  status: "PENDING" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED";
  idempotencyKey: string | null;
  subtotalPaise: number;
  discountCode: string | null;
  discountTotalPaise: number;
  taxTotalPaise: number;
  shippingTotalPaise: number;
  grandTotalPaise: number;
  currency: "INR";
  shippingName: string;
  shippingPhone: string | null;
  shippingAddressLine1: string;
  shippingAddressLine2: string | null;
  shippingCity: string;
  shippingState: string | null;
  shippingPostalCode: string;
  shippingCountry: string;
  trackingNumber: string | null;
  carrier: string | null;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];        // included on checkout + get order
}
```

### Order item

```ts
{
  id: string;
  storeId: string;
  orderId: string;
  productId: string | null;
  variantId: string | null;
  productTitle: string;
  variantTitle: string;
  sku: string;
  unitPricePaise: number;
  quantity: number;
  lineTotalPaise: number;
  createdAt: string;
  updatedAt: string;
}
```

### Address (saved customer address)

```ts
{
  id: string;
  storeId: string;
  customerId: string;
  name: string;
  phone: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;            // default "IN"
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### Category

```ts
{
  id: string;
  storeId: string;
  name: string;
  slug: string;
  parentId: string | null;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
}
```

### Collection

```ts
{
  id: string;
  storeId: string;
  name: string;
  slug: string;
  description: string | null;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
}
```

---

## Catalog

### GET `/store/details`

Store public profile for the publishable key.

**Headers:** `x-publishable-key`

**Response `data`:**

```json
{
  "id": "uuid",
  "name": "Store Name",
  "slug": "store-slug",
  "status": "ACTIVE",
  "domain": "shop.example.com",
  "contactEmail": "hello@example.com",
  "currency": "INR",
  "timezone": "Asia/Kolkata"
}
```

`domain` / `contactEmail` may be `null`. `currency` defaults to `"INR"`, `timezone` to `"Asia/Kolkata"`.

---

### GET `/store/products`

List active catalog products.

**Headers:** `x-publishable-key`

**Query:**

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `page` | int ≥ 1 | `1` | |
| `pageSize` | int 1–100 | `20` | |
| `categoryId` | uuid | — | Filter by category |
| `collectionId` | uuid | — | Filter by collection |
| `q` | string 1–200 | — | Search |
| `sort` | enum | `created_at_desc` | `created_at_desc` \| `price_asc` \| `price_desc` |
| `inStock` | boolean | — | `true` / `false` — only products with available stock when true |
| `minPricePaise` | int ≥ 0 | — | Min active variant price (paise) |
| `maxPricePaise` | int ≥ 0 | — | Max active variant price (paise) |

**Response `data`:** `Product[]` each with `thumbnail`, plus list pricing fields `minPricePaise`, `maxPricePaise`, and `inStock`

**Response `pagination`:** `{ page, pageSize, total, totalPages }`

```json
{
  "status": "success",
  "message": "...",
  "data": [
    {
      "id": "uuid",
      "storeId": "uuid",
      "categoryId": "uuid",
      "title": "Classic Tee",
      "handle": "classic-tee",
      "shortDescription": "...",
      "description": "...",
      "status": "ACTIVE",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z",
      "thumbnail": {
        "id": "uuid",
        "altText": "Front view",
        "src": "/api/v1/store/media/uuid"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 42,
    "totalPages": 3
  }
}
```

Load images via `GET {base}{thumbnail.src}` (same host as API).

---

### GET `/store/products/:handle`

Product detail by handle (kebab-case).

**Headers:** `x-publishable-key`

**Response `data`:** Product + `variants` (ACTIVE only) + `images` + `thumbnail`

```json
{
  "id": "uuid",
  "storeId": "uuid",
  "categoryId": "uuid",
  "title": "Classic Tee",
  "handle": "classic-tee",
  "shortDescription": "...",
  "description": "...",
  "status": "ACTIVE",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z",
  "variants": [
    {
      "id": "uuid",
      "storeId": "uuid",
      "productId": "uuid",
      "sku": "TEE-S",
      "title": "Small",
      "pricePaise": 99900,
      "compareAtPricePaise": 129900,
      "status": "ACTIVE",
      "availableQuantity": 12,
      "inStock": true,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "images": [
    {
      "id": "uuid",
      "storeId": "uuid",
      "productId": "uuid",
      "storageKey": "...",
      "url": null,
      "altText": "Front",
      "sortOrder": 0,
      "isThumbnail": true,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z",
      "src": "/api/v1/store/media/uuid"
    }
  ],
  "thumbnail": {
    "id": "uuid",
    "altText": "Front",
    "src": "/api/v1/store/media/uuid"
  }
}
```

`images[0]` is the main image (explicit thumbnail if set, else first by gallery order).

---

### GET `/store/media/:mediaId`

Binary media file for a product image.

**Headers:** `x-publishable-key`

**Response:** raw bytes (`Content-Type` from storage, `Cache-Control: public, max-age=3600`)

---

### GET `/store/categories`

**Headers:** `x-publishable-key`

**Response `data`:** `Category[]` (ACTIVE only)

---

### GET `/store/categories/:slug`

**Headers:** `x-publishable-key`

**Response `data`:** Category + `products` (up to 100 catalog products with `thumbnail`)

```json
{
  "id": "uuid",
  "storeId": "uuid",
  "name": "Apparel",
  "slug": "apparel",
  "parentId": null,
  "status": "ACTIVE",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z",
  "products": [
    {
      "id": "uuid",
      "title": "Classic Tee",
      "handle": "classic-tee",
      "thumbnail": { "id": "uuid", "altText": null, "src": "/api/v1/store/media/uuid" }
    }
  ]
}
```

---

### GET `/store/collections`

**Headers:** `x-publishable-key`

**Response `data`:** `Collection[]` (ACTIVE only)

---

### GET `/store/collections/:slug`

**Headers:** `x-publishable-key`

**Response `data`:** Collection + linked ACTIVE `products` (each product may include nested `variants` and `images` from the DB relation)

---

## Cart

Cart mutations are rate-limited.

### POST `/store/carts`

Create an empty cart.

**Headers:** `x-publishable-key`, optional `Authorization: Bearer <customer_token>` (attaches customer if valid)

**Body:** none

**Status:** `201`

**Response `data`:** Cart with `items: []`

---

### GET `/store/carts/:cartId`

**Headers:** `x-publishable-key`

**Response `data`:** Cart with `items`

---

### POST `/store/carts/:cartId/customer`

Attach the authenticated customer to an ACTIVE cart.

**Headers:** `x-publishable-key`, `Authorization: Bearer <customer_token>`

**Body:** none

**Response `data`:** Cart

Fails if cart already belongs to another customer.

---

### POST `/store/carts/:cartId/items`

Add or increment a line item.

**Headers:** `x-publishable-key`

**Request body:**

```json
{
  "variantId": "uuid",
  "quantity": 1
}
```

| Field | Type | Rules |
|-------|------|-------|
| `variantId` | uuid | Required |
| `quantity` | int | Required, positive |

**Response `data`:** Cart (subtotal/discount refreshed)

Errors: variant not found, insufficient stock.

---

### PATCH `/store/carts/:cartId/items/:itemId`

Set line quantity.

**Headers:** `x-publishable-key`

**Request body:**

```json
{
  "quantity": 2
}
```

**Response `data`:** Cart

---

### DELETE `/store/carts/:cartId/items/:itemId`

**Headers:** `x-publishable-key`

**Response `data`:** Cart

---

### POST `/store/carts/:cartId/discount`

Apply or clear a discount code.

**Headers:** `x-publishable-key`

**Apply:**

```json
{
  "code": "SAVE10"
}
```

**Clear** (any of these):

```json
{ "code": null }
```

```json
{ "code": "" }
```

Code must be `ACTIVE`, within optional `startsAt`/`endsAt` (start inclusive, end exclusive), meet optional `minOrderPaise` against cart subtotal, and not exceed `usageLimit`. Checkout increments `usageCount` when an order uses the code.

**Response `data`:** Cart with updated `discountCode`, `discountTotalPaise`, `subtotalPaise`

---

### POST `/store/carts/:cartId/shipping-address`

Set guest/inline shipping address on the cart.

**Headers:** `x-publishable-key`

**Request body:**

```json
{
  "name": "Customer Name",
  "phone": "9999999999",
  "addressLine1": "12 MG Road",
  "addressLine2": "Floor 2",
  "city": "Bengaluru",
  "state": "KA",
  "postalCode": "560001",
  "country": "IN"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `name` | yes | |
| `phone` | no | |
| `addressLine1` | yes | |
| `addressLine2` | no | |
| `city` | yes | |
| `state` | no | |
| `postalCode` | yes | |
| `country` | no | Default `"IN"` |

**Response `data`:** Cart

---

### POST `/store/carts/:cartId/shipping-address/from-saved`

Copy a saved customer address onto the cart.

**Headers:** `x-publishable-key`, `Authorization: Bearer <customer_token>`

**Request body:**

```json
{
  "addressId": "uuid"
}
```

**Response `data`:** Cart (also sets `customerId`)

---

### POST `/store/carts/:cartId/email`

Set or update the contact email on an ACTIVE cart (required before checkout unless provided at checkout / via customer account).

**Headers:** `x-publishable-key`

**Request body:**

```json
{
  "email": "customer@example.com"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `email` | yes | Valid email; normalized |

**Response `data`:** Cart

---

### POST `/store/carts/:cartId/checkout`

Convert ACTIVE cart to an order. Requires shipping address, at least one item, and an email (cart email, checkout body `email`, or authenticated customer email).

**Headers:**

- `x-publishable-key`
- optional `Authorization: Bearer <customer_token>`
- optional `Idempotency-Key`

**Request body** (optional):

```json
{
  "discountCode": "SAVE10",
  "email": "customer@example.com"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `discountCode` | no | Overrides or supplements cart discount; uses cart code if omitted |
| `email` | no* | Valid email; used when cart has no email / no customer email |

\*Checkout fails with validation error if no email can be resolved from body, cart, or customer.

Empty body `{}` is allowed when the cart already has an email (or an authenticated customer with email).

**Status:** `201` (or `200` if idempotent replay)

**Response `data`:** Order with `items`

Cart becomes `CHECKED_OUT`. Inventory is decremented.

**Totals (INR paise):**

- `discountTotalPaise` from applied code (if any)
- `taxTotalPaise` = store GST % on `(subtotalPaise − discountTotalPaise)` (floored)
- `shippingTotalPaise` from store shipping settings (`flat` / `free_over` / `off`)
- `grandTotalPaise` = discounted merchandise + GST + shipping

Payments are not collected at checkout (orders are created as `PENDING`).

---

## Customer auth

### POST `/store/auth/register`

**Headers:** `x-publishable-key`

**Request body:**

```json
{
  "email": "customer@example.com",
  "password": "Customer@123",
  "name": "Test Customer",
  "phone": "9999999999"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `email` | yes | Valid email; normalized |
| `password` | yes | Min 8 chars |
| `name` | yes | |
| `phone` | no | |

**Status:** `201`

**Response `data`:**

```json
{
  "accessToken": "jwt...",
  "customer": {
    "id": "uuid",
    "email": "customer@example.com",
    "name": "Test Customer",
    "storeId": "uuid"
  }
}
```

---

### POST `/store/auth/login`

**Headers:** `x-publishable-key`

**Request body:**

```json
{
  "email": "customer@example.com",
  "password": "Customer@123"
}
```

**Response `data`:** same shape as register (`accessToken` + `customer`)

---

### GET `/store/auth/me`

**Headers:** `x-publishable-key`, `Authorization: Bearer <customer_token>`

**Response `data`:**

```json
{
  "id": "uuid",
  "email": "customer@example.com",
  "name": "Test Customer",
  "storeId": "uuid"
}
```

---

## Customer orders

Requires customer JWT (except guest lookup).

### GET `/store/orders/lookup`

Guest order lookup by order number + email (must match the order contact email).

**Headers:** `x-publishable-key`

**Query:**

| Param | Required | Notes |
|-------|----------|-------|
| `orderNumber` | yes | Exact order number |
| `email` | yes | Valid email; normalized |

**Response `data`:** Order with `items` and `returns`

---

### GET `/store/orders`

**Headers:** `x-publishable-key`, `Authorization: Bearer <customer_token>`

**Response `data`:** `Order[]` for the logged-in customer (newest first). Line items are not included in the list.

---

### GET `/store/orders/:orderId`

**Headers:** `x-publishable-key`, `Authorization: Bearer <customer_token>`

**Response `data`:** Order with `items` and `returns` (must belong to the authenticated customer)

---

### POST `/store/orders/:orderId/return`

Request a full-order return for a **DELIVERED** order. Restock happens only after Store Admin approval. **No payment refund** (payments are not collected).

**Headers:** `x-publishable-key`, `Authorization: Bearer <customer_token>`

**Request body:**

```json
{
  "reason": "Item arrived damaged"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `reason` | yes | 3–1000 characters |

**Status:** `201`

**Response `data`:** Return (`REQUESTED`)

Rules:

- Order must be `DELIVERED` and owned by the customer
- At most one `REQUESTED` or `APPROVED` return per order (may request again after `REJECTED`)

---

## Customer addresses

Requires customer JWT.

### GET `/store/addresses`

**Headers:** `x-publishable-key`, `Authorization: Bearer <customer_token>`

**Response `data`:** `Address[]` (newest first)

---

### POST `/store/addresses`

**Headers:** `x-publishable-key`, `Authorization: Bearer <customer_token>`

**Request body:**

```json
{
  "name": "Test Customer",
  "phone": "9999999999",
  "addressLine1": "12 MG Road",
  "addressLine2": "Floor 2",
  "city": "Bengaluru",
  "state": "KA",
  "postalCode": "560001",
  "country": "IN",
  "isDefault": true
}
```

Same fields as shipping address, plus optional `isDefault` (boolean). Setting `isDefault: true` clears default on other addresses.

**Status:** `201`

**Response `data`:** Address

---

### PATCH `/store/addresses/:addressId`

**Headers:** `x-publishable-key`, `Authorization: Bearer <customer_token>`

**Request body:** any subset of create fields (at least one field)

```json
{
  "addressLine1": "14 MG Road",
  "isDefault": true
}
```

**Response `data`:** Address

---

### DELETE `/store/addresses/:addressId`

**Headers:** `x-publishable-key`, `Authorization: Bearer <customer_token>`

**Response `data`:**

```json
{
  "deleted": true
}
```

---

## Endpoint index

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/store/details` | publishable |
| GET | `/api/v1/store/products` | publishable |
| GET | `/api/v1/store/products/:handle` | publishable |
| GET | `/api/v1/store/media/:mediaId` | publishable (binary) |
| GET | `/api/v1/store/categories` | publishable |
| GET | `/api/v1/store/categories/:slug` | publishable |
| GET | `/api/v1/store/collections` | publishable |
| GET | `/api/v1/store/collections/:slug` | publishable |
| POST | `/api/v1/store/carts` | publishable (+ optional customer) |
| GET | `/api/v1/store/carts/:cartId` | publishable |
| POST | `/api/v1/store/carts/:cartId/customer` | publishable + customer |
| POST | `/api/v1/store/carts/:cartId/items` | publishable |
| PATCH | `/api/v1/store/carts/:cartId/items/:itemId` | publishable |
| DELETE | `/api/v1/store/carts/:cartId/items/:itemId` | publishable |
| POST | `/api/v1/store/carts/:cartId/discount` | publishable |
| POST | `/api/v1/store/carts/:cartId/shipping-address` | publishable |
| POST | `/api/v1/store/carts/:cartId/shipping-address/from-saved` | publishable + customer |
| POST | `/api/v1/store/carts/:cartId/email` | publishable |
| POST | `/api/v1/store/carts/:cartId/checkout` | publishable (+ optional customer) |
| POST | `/api/v1/store/auth/register` | publishable |
| POST | `/api/v1/store/auth/login` | publishable |
| GET | `/api/v1/store/auth/me` | publishable + customer |
| GET | `/api/v1/store/orders/lookup` | publishable |
| GET | `/api/v1/store/orders` | publishable + customer |
| GET | `/api/v1/store/orders/:orderId` | publishable + customer |
| POST | `/api/v1/store/orders/:orderId/return` | publishable + customer |
| GET | `/api/v1/store/addresses` | publishable + customer |
| POST | `/api/v1/store/addresses` | publishable + customer |
| PATCH | `/api/v1/store/addresses/:addressId` | publishable + customer |
| DELETE | `/api/v1/store/addresses/:addressId` | publishable + customer |

---

## Typical checkout flow

```text
1. GET  /store/products
2. GET  /store/products/:handle          → pick variantId
3. POST /store/carts
4. POST /store/carts/:cartId/items       { variantId, quantity }
5. POST /store/carts/:cartId/discount    { code }            (optional)
6. POST /store/carts/:cartId/shipping-address  { ... }
   — or login + POST .../shipping-address/from-saved
7. POST /store/carts/:cartId/email       { email }           (or pass email at checkout)
8. POST /store/carts/:cartId/checkout    (+ Idempotency-Key)
```

Related Postman collection: `apps/api/postman/Ecommerce-Storefront.postman_collection.json`
