# API

Hono + TypeScript Cloudflare Worker.

## Routes

- `/api/v1/auth` — shared admin login/refresh/logout/me
- `/api/v1/platform` — platform super admin
- `/api/v1/admin` — store admin (JWT `storeId`)
- `/api/v1/store` — storefront (`x-publishable-key`)

## Scripts

```bash
npm run dev
npm run typecheck
npm run test
npm run db:generate
npm run db:migrate
npm run db:seed
```

## Env

Copy `.env.example` → `.env`. Requires `DATABASE_URL`, `JWT_SECRET`, seed passwords.

Optional ZeptoMail (`ZEPTOMAIL_TOKEN`, `ZEPTOMAIL_FROM`): after storefront checkout the API sends an order-placed mail to `order.email`. Checkout still succeeds if mail is unset or the provider fails. For `wrangler dev`, copy the same keys into `.dev.vars`.

Postman collections: [`postman/`](./postman/).

## Smoke checklist

1. Login as Alora Fashion admin (`/login` → `/admin`).
2. Create product → add variant (price in paise) → upload image → set ACTIVE.
3. Create collection → attach product → confirm storefront `GET /store/collections/:slug` returns products.
4. Storefront: create cart → add line → checkout with `Idempotency-Key`.
5. Admin: open order detail → fulfill with `trackingNumber` / `carrier`.
6. Confirm Zentrix cannot access Alora Fashion resources (isolation tests: `npm run test`).

