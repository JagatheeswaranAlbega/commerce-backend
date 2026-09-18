# Multi-Tenant Ecommerce

Turborepo monorepo for a Medusa-like multi-tenant headless commerce platform.

## Apps

- `apps/api` — Hono + TypeScript on Cloudflare Workers (PostgreSQL via Hyperdrive, Drizzle, R2, Inventory Durable Object)
- `apps/web` — Next.js App Router unified admin (`/admin`) for Platform + Store Admin

## Auth model

- **One login page:** `/login`
- Shared API: `POST /api/v1/auth/login`
- JWT roles: `PLATFORM_SUPER_ADMIN` (`storeId: null`) → `/admin`
- JWT roles: `STORE_ADMIN` (fixed `storeId`) → `/admin`
- Role/permissions drive menus and pages inside the same `/admin` app
- Storefront (external): `x-publishable-key: pk_live_...`
- Server integrations: `Authorization: Bearer sk_live_...` (hashed at rest)

## API surfaces

| Prefix | Audience |
|--------|----------|
| `/api/v1/auth` | Shared admin auth |
| `/api/v1/platform` | Platform Super Admin |
| `/api/v1/admin` | Store Admin (scoped by JWT) |
| `/api/v1/store` | Headless storefront (publishable key) |

Money is **INR integer paise** only.

## Local development

1. Start Postgres (Docker Compose maps host `5433`):

```bash
docker compose up -d
```

2. Configure API env:

```bash
cp apps/api/.env.example apps/api/.env
```

3. Migrate + seed:

```bash
cd apps/api
npm run db:migrate
npm run db:seed
```

Seed prints Store A/B publishable and secret keys for Postman.

4. Run apps:

```bash
# from repo root
npm run dev
```

- API: `http://localhost:8787`
- Web: `http://localhost:3000` (or Next default)

Default seed logins:

- Platform: `platform@local.dev` / `Platform@123`
- Store A admin: `admin@store-a.local` / `SEED_STORE_PASSWORD`
- Store B admin: `admin@store-b.local` / `SEED_STORE_PASSWORD`

## Postman handoff

See [`apps/api/postman/README.md`](apps/api/postman/README.md).

## Smoke checklist

1. Login as Store Admin → create product/variant (with initial stock + images) → ACTIVE
2. Confirm storefront: `GET /api/v1/store/products` with `x-publishable-key` (Postman Storefront collection) — only ACTIVE products appear
3. Storefront cart → checkout (idempotency key)
4. Admin order detail → fulfill with tracking/carrier
5. `cd apps/api && npm run test` (auth + isolation)

There is **no shop UI** in `apps/web`. Catalog for customers is the headless `/api/v1/store` API.

## Docs

Canonical product/architecture docs live under [`docs/`](docs/). Cursor rules under [`.cursor/rules/`](.cursor/rules/).
