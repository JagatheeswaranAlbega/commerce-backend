# Development and Operations Plan

## 1. Prerequisites

- Node.js 20+
- npm/pnpm as selected for the monorepo
- Turborepo
- Cloudflare Wrangler
- PostgreSQL
- Docker where useful for local infrastructure

## 2. Environment

API development variables should contain items such as:

```text
JWT_SECRET
DATABASE_URL
R2_BUCKET_NAME
DEFAULT_CURRENCY=INR
```

Web:

```text
NEXT_PUBLIC_API_URL
```

Never commit real credentials.

## 3. Local Development

```text
Install dependencies
      ↓
Configure API environment
      ↓
Configure web environment
      ↓
Generate Drizzle migrations
      ↓
Run migrations
      ↓
Seed platform admin
      ↓
Start API + web
```

## 4. Seed Data

Development should include:

- one Platform Super Admin
- Store A
- Store B
- one Store A admin
- one Store B admin
- sample products/variants/categories
- publishable keys
- secret key hashes

## 5. Testing Matrix

### Authentication

- Platform login
- Store Admin login
- invalid credentials
- expired JWT
- refresh
- logout

### Tenant isolation

- Store A reads only A
- Store A cannot read B by ID
- Store A cannot update B
- Store A cannot delete B
- Store B cannot read A
- Platform can access permitted global resources

### Storefront

- publishable key resolves correct store
- invalid key rejected
- Store A key never returns Store B catalog
- cart belongs to correct store
- checkout cannot use another store's variant

### Inventory

- valid stock decrement
- insufficient stock
- concurrent checkout
- rollback on order failure

## 6. CI

Recommended pipeline:

```text
Install
 ↓
Lint
 ↓
Typecheck
 ↓
Unit tests
 ↓
Integration/API tests
 ↓
Build
 ↓
Deployment
```

## 7. Production

Use:

- Cloudflare Workers
- Hyperdrive
- PostgreSQL
- R2
- production secrets
- monitoring/logging
- backups and migration discipline

## 8. Security Operations

- Rotate secret keys
- Rotate refresh tokens
- Never log passwords or raw secret keys
- Avoid logging full Authorization headers
- Audit administrative actions
- Rate-limit authentication and sensitive endpoints
- Validate all inputs
