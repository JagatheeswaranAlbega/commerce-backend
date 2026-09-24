# Headless E-Commerce Storefront Architecture

## 1. Purpose

The Storefront API is the customer-facing API used by any frontend, mobile app, or future channel.

Catalog listing and product-by-handle include both **store-local** products and **imported global** products (`source: STORE | GLOBAL`). Cart, wishlist, and checkout resolve variants through a sellable-variant helper that accepts local variants or imported ACTIVE global variants. Prices for global variants come from the platform master; stock is per-store inventory keyed by `(store_id, variant_id)`.

There can be many frontends while there is still only one backend.

```text
Store A Next.js ─────┐
Store A Mobile ──────┤
Store B Next.js ─────┤
Store C App ─────────┤
                     ▼
              Same Store API
```

## 2. Store Identification

The frontend sends:

```http
x-publishable-key: pk_live_store_a_...
```

The backend resolves the key to Store A.

## 3. Storefront Flow

```text
Customer opens Store A frontend
 ↓
Frontend has Store A publishable key
 ↓
GET /api/v1/store/products
 ↓
Middleware resolves Store A
 ↓
Catalog query is scoped to Store A
 ↓
Products returned
```

## 4. Catalog

Frontend can:

- list products
- search/filter products
- view categories
- view collections
- view product details
- inspect variants
- inspect available stock state

Only published/publicly eligible data should be exposed.

## 5. Cart

```text
POST /store/carts
        ↓
cart belongs to Store A
        ↓
POST /store/carts/:cartId/items
        ↓
variant must belong to Store A
```

A Store A cart cannot contain a Store B variant.

## 5b. Wishlist

Authenticated customers can save variants to a per-store wishlist:

```text
POST /store/wishlist  { variantId }
        ↓
customer JWT + publishable key resolve Store A
        ↓
variant must belong to Store A and be ACTIVE
```

Wishlist is customer-owned (no guest wishlist). Duplicate adds are idempotent.

## 6. Checkout

```text
Cart
 ↓
Validate cart
 ↓
Validate store ownership
 ↓
Validate inventory
 ↓
Calculate totals
 ↓
Create order
 ↓
Create order items
 ↓
Update/reserve inventory
 ↓
Return order result
```

Use a transaction where operations must be atomic.

## 7. Customer Frontend Responsibility

The external frontend team should receive:

- API base URL
- Store-specific publishable key
- Storefront Postman collection
- Store-specific Postman environment
- API documentation

Do not provide the secret key to browser/frontend code.

## 8. Future Frontends

The backend should not change simply because:

```text
Store A uses Next.js
Store B uses React
Store C uses mobile app
Store D uses another framework
```

They all consume the same API contracts.
