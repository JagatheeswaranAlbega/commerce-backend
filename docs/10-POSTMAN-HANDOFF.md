# Postman Collection and External Integration Handoff

## 1. Where Postman Lives

Keep Postman artifacts in the repository:

```text
postman/
├── Ecommerce-Platform-Admin.postman_collection.json
├── Ecommerce-Store-Admin.postman_collection.json
├── Ecommerce-Storefront.postman_collection.json
├── Store-A.postman_environment.json
├── Store-B.postman_environment.json
└── README.md
```

The exact filenames can be changed, but the separation should remain clear.

## 2. Collection Separation

### Platform collection

Contains:

```text
Auth
Platform
  Stores
  Store Admins
  Keys
  Global Metrics
```

### Store Admin collection

Contains:

```text
Auth
Admin
  Products
  Variants
  Media
  Categories
  Collections
  Collection Products
  Inventory
  Orders
  Fulfillment (trackingNumber, carrier)
  Discounts
```

### Storefront collection

Contains:

```text
Store
  Details
  Products
  Categories
  Collections
  Carts
  Checkout
```

This is the collection intended for an external storefront frontend team.

## 3. Environment Variables

Recommended:

```text
base_url
publishable_key
secret_key
jwt_token
store_id
cart_id
product_id
variant_id
order_id
```

Do not distribute secret keys or admin credentials to browser/frontend teams.

## 4. Store A Handoff

For Store A frontend team:

```text
Ecommerce-Storefront.postman_collection.json
+
Store-A.postman_environment.json
```

The Store A environment contains Store A's publishable key.

## 5. Store B Handoff

For Store B:

```text
Ecommerce-Storefront.postman_collection.json
+
Store-B.postman_environment.json
```

The collection is reused. Only the store-specific environment changes.

## 6. Request Example

```http
GET {{base_url}}/store/products

x-publishable-key: {{publishable_key}}
```

The backend resolves the store from the publishable key.

## 7. Testing Store Isolation

Run the same collection with:

```text
Store-A environment
```

and then:

```text
Store-B environment
```

The same request must return each store's catalog.

## 8. Admin Testing

Admin requests use:

```http
Authorization: Bearer {{jwt_token}}
```

The JWT determines the admin's role and store scope.

## 9. Handoff Documentation

The external team should receive:

1. API base URL
2. Storefront Postman collection
3. Store-specific environment
4. endpoint documentation
5. authentication explanation
6. example request/response
7. error code list
8. integration notes

## 10. Important Rule

Do not create a separate backend collection for every store.

Reuse the Storefront collection and change only the environment/key.

That keeps the API contract centralized.
