# Postman Handoff

## Collections

- `Ecommerce-Platform-Admin.postman_collection.json` — `/auth` + `/platform`
- `Ecommerce-Store-Admin.postman_collection.json` — `/auth` + `/admin`
- `Ecommerce-Storefront.postman_collection.json` — `/store` (external frontend team)

## Environments

- `Store-A.postman_environment.json`
- `Store-B.postman_environment.json`

After `npm run db:seed`, copy each store’s `publishable_key` into the matching environment.

The storefront header must be a **single line**: `pk_live_` plus hex. Do not paste the Create Key JSON body, quotes, or a trailing newline into `x-publishable-key` — Postman will fail with `Invalid character in header content ["x-publishable-key"]` and the request never reaches the API.

Copy `data.rawKey` from Platform **Create Key**, or `data.keys.publishableKey` from **Create Store**. **List Keys** only returns `keyPrefix`, not the full key.

## Storefront team package

```text
Ecommerce-Storefront.postman_collection.json
+
Store-A.postman_environment.json   # or Store-B
```

Never give secret keys (`sk_live_...`) to browser/frontend teams.

## Base URL

Local: `http://localhost:8787/api/v1`

## Auth headers

| Surface | Header |
|---------|--------|
| Platform / Store Admin | `Authorization: Bearer {{jwt_token}}` from `POST /auth/login` |
| Storefront | `x-publishable-key: {{publishable_key}}` |
| Customer (storefront) | publishable key + `Authorization: Bearer {{customer_token}}` |
| Checkout idempotency | `Idempotency-Key` |

## Smoke path (merchant loop)

1. Platform: Create store (admin email/password) → copy one-time keys
2. Store Admin: Login → catalog/inventory → create discount
3. Storefront: search products (`q`), inspect stock on PDP, cart (stock-checked), checkout with discount
4. Customer: login → list/get orders; Admin: cancel restores stock

Isolation: load Store-B env and confirm admin/storefront calls cannot read Store A IDs.
