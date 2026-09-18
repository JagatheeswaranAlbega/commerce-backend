# Database Architecture and Data Dictionary

## 1. Database

PostgreSQL is the primary database.

Drizzle ORM defines schemas and migrations.

Cloudflare Workers connect through Cloudflare Hyperdrive in deployment.

## 2. Tenant Rule

Every tenant-owned commerce table contains:

```text
store_id NOT NULL REFERENCES stores(id)
```

Examples:

- products
- product_variants
- categories
- collections
- carts
- cart_line_items
- orders
- order_items
- api_keys
- inventory-related records

## 3. Core Tables

### stores

Purpose: tenant/store registry.

Important fields:

- `id`
- `name`
- `slug`
- `status`
- timestamps

### users

Purpose: platform and store admin identities.

Important fields:

- `id`
- `email`
- `password_hash`
- `role`
- `store_id` for store-scoped users
- timestamps

### api_keys

Purpose: publishable and secret key records.

Important fields:

- `id`
- `store_id`
- `type`
- `key_prefix`
- `secret_hash` where applicable
- status
- timestamps

Never store raw `sk_live_...`.

### products

Important fields:

- `id`
- `store_id`
- `title`
- `handle`
- `description`
- `status`
- timestamps

### product_variants

Important fields:

- `id`
- `store_id`
- `product_id`
- `sku`
- price in paise
- stock-related state
- timestamps

### categories

Important fields:

- `id`
- `store_id`
- `name`
- `slug`
- timestamps

### collections

Important fields:

- `id`
- `store_id`
- `name`
- `slug`
- timestamps

### carts

Important fields:

- `id`
- `store_id`
- customer/session information
- totals
- timestamps

### cart_line_items

Important fields:

- `id`
- `store_id`
- `cart_id`
- `variant_id`
- `quantity`
- unit price in paise
- timestamps

### orders

Important fields:

- `id`
- `store_id`
- customer reference
- status
- subtotal in paise
- tax in paise where applicable
- shipping in paise
- total in paise
- currency
- payment status
- tracking number
- timestamps

### order_items

Important fields:

- `id`
- `store_id`
- `order_id`
- `variant_id`
- title snapshot
- SKU snapshot
- quantity
- unit price in paise
- total in paise

## 4. Money Rules

Never use float.

Use integer paise.

Examples:

```text
₹999.00  -> 99900
₹1,999.00 -> 199900
```

## 5. Indexing

Tenant filtering must be efficient.

Recommended patterns include:

```text
(store_id)
(store_id, id)
(store_id, handle)
(store_id, sku)
```

For tenant-scoped uniqueness:

```text
UNIQUE(store_id, handle)
UNIQUE(store_id, sku)
```

## 6. Foreign Keys

Tenant-owned child tables should retain tenant identity so queries and constraints remain explicit.

## 7. Primary Keys

Use UUID/CUID2-style string identifiers consistently.

## 8. Deletion

Never perform a Store Admin update/delete by resource ID alone.

Conceptually:

```text
WHERE id = resourceId
AND store_id = contextStoreId
```

Platform operations are the explicit exception where cross-store access is authorized.

## 9. Migration Workflow

```text
Schema change
   ↓
Drizzle migration generation
   ↓
Review migration
   ↓
Apply to development DB
   ↓
Run tests
   ↓
Apply through deployment workflow
```
