# Security and Tenant Isolation Rules

## 1. Primary Security Principle

Never trust the frontend to enforce authorization.

The backend is the authority.

## 2. Store Admin

A Store Admin has:

```text
role = STORE_ADMIN
storeId = assigned store
```

Every store-scoped query uses that store ID.

## 3. Platform Admin

Platform access requires:

```text
role = PLATFORM_SUPER_ADMIN
```

Global access is explicit.

## 4. Publishable Key

Safe for browser usage.

It identifies the store and permits public storefront operations.

It must not:

- manage products
- manage orders as an admin
- manage users
- access other stores
- expose secret credentials

## 5. Secret Key

Secret key is server-only.

Rules:

- never place in browser code
- never commit to Git
- never log raw value
- store SHA-256 hash
- display raw key only at generation time
- revoke/rotate when compromised

## 6. Passwords

Store password hashes, never plaintext passwords.

## 7. JWT

Recommended hardening:

- short access-token lifetime
- refresh-token rotation
- server-side revocation strategy where appropriate
- secure cookie strategy if cookies are used
- never put sensitive secrets into JWT claims

## 8. Tenant Attack Examples

Reject:

```text
GET /admin/products/store-b-product-id
```

when authenticated Store A admin owns Store A.

Reject:

```text
PATCH Store B product
```

from Store A.

Reject a Store A cart adding a Store B variant.

## 9. Audit Log

Record sensitive administrative actions such as:

- store creation
- admin creation
- product deletion
- inventory adjustment
- order status changes
- key creation/revocation

## 10. Idempotency

Use idempotency protection for operations where duplicate requests can create duplicate business effects, especially checkout/payment-related operations.
