# Multi-Tenant Headless E-Commerce Platform — Overview

## 1. Purpose

Build one reusable, headless, multi-tenant commerce backend that can power Store A, Store B, and many future stores without maintaining a separate backend per store.

The baseline architecture uses:

- Turborepo monorepo
- `apps/api` — Hono + TypeScript on Cloudflare Workers
- PostgreSQL
- Cloudflare Hyperdrive for the Worker-to-PostgreSQL connection layer
- Drizzle ORM + Drizzle Kit
- Cloudflare R2 for media/catalog assets
- `apps/web` — Next.js App Router, Tailwind, Shadcn UI, TanStack Query/Table
- Vitest for API testing
- INR-only monetary calculations using integer paise

## 2. Core Principle

One backend serves many stores.

```text
Store A Frontend ─┐
Store B Frontend ─┤
Store C Frontend ─┤
Future Frontends ─┤
                  ▼
          Cloudflare Workers API
                  │
             Hyperdrive
                  │
                  ▼
            PostgreSQL
```

There is no separate API deployment for each store.

## 3. Three Consumer Surfaces

### Management portal

One `/login` page is shared by:

- `PLATFORM_SUPER_ADMIN`
- `STORE_ADMIN`

After login, the JWT role and `storeId` determine the dashboard experience.

### Storefront API

Public/headless clients use:

```http
x-publishable-key: pk_live_...
```

The key resolves to one store.

### Server-to-server API

Trusted integrations use:

```http
Authorization: Bearer sk_live_...
```

The secret key is stored as a SHA-256 hash and remains scoped to its owning store.

## 4. Tenant Isolation

Every tenant-scoped commerce table contains a non-nullable `store_id`.

Store Admin and Storefront requests must always be scoped to the resolved store.

Example conceptual rule:

```text
WHERE store_id = currentStoreId
```

A Store A request must never return Store B records.

## 5. Important Terminology

Use "application-level tenant isolation" unless PostgreSQL Row-Level Security is actually implemented.

The architecture document uses the concept of shared database/shared schema logical isolation. The implementation must make the tenant filter mandatory in repository/service operations.

## 6. Currency

Currency is strictly INR.

All monetary values are integer paise.

Examples:

- ₹1 = `100`
- ₹499 = `49900`
- ₹1,999 = `199900`

Never use floating-point values for money.

## 7. High-Level Modules

```text
Authentication
Platform Administration
Store Administration
Storefront
Catalog
Categories
Collections
Variants
Inventory
Customers
Carts
Checkout
Orders
Fulfillment
Discounts
API Keys
Media
Audit Logging
Testing
Documentation/Postman
```
