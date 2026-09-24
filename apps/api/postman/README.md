# Postman Handoff

## Collections

- `Ecommerce-Platform-Admin.postman_collection.json` — `/auth` + `/platform`
- `Ecommerce-Store-Admin.postman_collection.json` — `/auth` + `/admin`
- `Ecommerce-Storefront.postman_collection.json` — `/store` (external frontend team)

## Environments

- `Store-A.postman_environment.json` (Alora Fashion)
- `Store-B.postman_environment.json` (Zentrix)

After `npm run db:seed`, create a **new publishable key** (or copy from Create Store) and paste it into the matching environment’s `publishable_key`.

The storefront header must be a **single line**: `pk_live_` plus hex. Do not paste the Create Key JSON body, quotes, or a trailing newline into `x-publishable-key` — Postman will fail with `Invalid character in header content ["x-publishable-key"]` and the request never reaches the API.

Copy `data.rawKey` from Platform **Create Key**, or `data.keys.publishableKey` from **Create Store**. **List Keys** only returns `keyPrefix` (e.g. `pk_live_00161409…`) — that partial value will not authenticate.

Seed defaults in the envs:
- Alora (`Store-A`): product `emerald-kanjeevaram-saree`, category `womens-ethnic-wear`
- Zentrix (`Store-B`): product `ivory-soft-cotton-romper`, category `baby-boys`

`SAVE10` is not seeded — create an ACTIVE discount in Store Admin before Apply Discount / checkout with a code.

## Storefront team package

```text
Ecommerce-Storefront.postman_collection.json
+
Store-A.postman_environment.json   # Alora Fashion, or Store-B for Zentrix
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

1. Platform: Create store (name/slug) → copy one-time keys. Create a Store Admin separately (`POST /platform/stores/:storeId/admins`) before Store Admin login.
2. Store Admin: Login → catalog/inventory → create discount
3. Storefront: Details → List/Search products → Get Product (saves `variant_id`) → cart → email/shipping → checkout
4. Customer: register/login → addresses → list/get orders → request return only after order is **DELIVERED**
5. Isolation: load Zentrix env and confirm admin/storefront calls cannot read Alora Fashion IDs

Storefront collection covers all `/store` routes including `POST /store/orders/:orderId/return`.
