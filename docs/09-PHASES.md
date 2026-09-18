# Complete Implementation Phases

## Phase 0 — Project Foundation

Deliver:

- Turborepo
- `apps/api`
- `apps/web`
- shared configuration
- TypeScript
- lint/typecheck
- Wrangler
- basic Hono app
- basic Next.js app

Exit criteria: both applications run locally.

## Phase 1 — API Foundation

Implement:

- Hono application
- `/api/v1`
- route registration
- error handling
- response envelope
- environment configuration
- Zod validation
- logging baseline

Exit criteria: health endpoint works and API conventions are established.

## Phase 2 — Database Foundation

Implement:

- PostgreSQL connection
- Drizzle configuration
- stores
- users
- api_keys
- base commerce schema
- indexes
- migrations
- seed

Exit criteria: migrations and seed work cleanly.

## Phase 3 — Authentication

Implement:

- password hashing
- shared login
- JWT/session model
- refresh-token strategy
- logout
- `/auth/me`
- role resolution

Exit criteria: Platform Admin and Store Admin can authenticate through the same login.

## Phase 4 — Authorization and Tenant Context

Implement:

- `requirePlatformAdmin`
- `requireStoreAdmin`
- storefront key middleware
- secret-key middleware
- request context
- `storeId`
- `role`
- `accessType`

Exit criteria: Store A cannot access Store B.

## Phase 5 — Store Management

Implement Platform APIs:

- create store
- update store
- deactivate store
- list stores
- store details
- create Store Admin

Exit criteria: Platform Admin can onboard stores.

## Phase 6 — Catalog

Implement:

- products
- variants
- categories
- collections
- media metadata
- CRUD
- publishing/status

Exit criteria: Store Admin can manage its own catalog.

## Phase 7 — Inventory

Implement:

- stock
- adjustments
- stock availability
- low-stock logic
- safe concurrent updates

Exit criteria: inventory is tenant scoped and consistent.

## Phase 8 — Storefront Catalog

Implement:

- store details
- product listing
- product detail
- categories
- collections
- publishable-key resolution

Exit criteria: Store A frontend sees Store A only.

## Phase 9 — Cart

Implement:

- create cart
- get cart
- add item
- update quantity
- remove item
- shipping address

Exit criteria: cart cannot cross store boundaries.

## Phase 10 — Checkout and Orders

Implement:

- totals
- inventory validation
- order creation
- order items
- status
- transactional boundaries
- idempotency

Exit criteria: checkout creates correct orders and inventory changes.

## Phase 11 — Store Admin Operations

Implement:

- order management
- fulfillment
- customer views
- discounts
- dashboard metrics

Exit criteria: Store Admin has a usable commerce console.

## Phase 12 — Platform Console

Implement:

- global dashboard
- stores
- store admins
- global metrics
- key management
- audit logs

Exit criteria: Platform Admin can operate the platform.

## Phase 13 — R2 and Media

Implement:

- R2 binding
- upload flow
- image metadata
- product media association
- deletion/cleanup

Exit criteria: catalog images work in development and deployment.

## Phase 14 — Security Hardening

Implement/test:

- refresh token rotation
- secret key hashing
- rate limits
- audit logs
- authorization tests
- tenant leak tests
- secure headers
- secret redaction

Exit criteria: security test suite passes.

## Phase 15 — Postman and External Handoff

Create:

- Storefront API collection
- Platform Admin collection
- Store Admin collection
- Store A environment
- Store B environment
- README for external teams

Exit criteria: another frontend team can integrate without reading backend source code.

## Phase 16 — Production Readiness

Validate:

- migration strategy
- backups
- monitoring
- error tracking
- deployment
- rollback
- load/concurrency tests
- API documentation
- operational runbook

Exit criteria: production release checklist is complete.
