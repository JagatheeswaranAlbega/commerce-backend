# Product Requirements Document

## 1. Product Goal

Create a Medusa-like headless commerce backend focused on multi-tenant operation, with one API infrastructure serving many independent stores.

## 2. Users

### Platform Super Admin

Global operator.

Responsibilities:

- Create stores
- View all stores
- Manage store lifecycle
- Create/manage store admin accounts
- Manage publishable and secret keys
- View global metrics
- View/manage cross-store data where explicitly permitted

### Store Admin

Operator for exactly one store.

Responsibilities:

- Manage products
- Manage variants
- Manage categories
- Manage collections
- Manage inventory
- Review orders
- Manage fulfillment
- Configure discounts
- Manage store-specific settings
- Manage store API credentials where permission is granted

Store A admin cannot access Store B data.

### End Customer

Uses the headless storefront.

Capabilities:

- Browse products
- View product details
- View categories/collections
- Create cart
- Add/update/remove cart items
- Provide shipping address
- Checkout
- Receive order result

## 3. Functional Requirements

### Authentication

- One dashboard login page
- One login endpoint
- Role returned by authentication
- JWT includes `userId`, `role`, and `storeId`
- Platform admin has `storeId = null`
- Store admin has a fixed store ID

### Storefront

- Public catalog
- Store details
- Product details
- Variant availability
- Cart lifecycle
- Checkout

### Multi-tenancy

Every store-owned resource must be tenant scoped.

### API integration

Each store can receive its own:

- Publishable key
- Secret key

The external frontend team receives a Postman collection/environment appropriate to the store.

## 4. Non-Functional Requirements

- Strong tenant isolation
- Consistent API response envelope
- Validation with Zod
- Automated API tests
- Production-safe secret handling
- Pagination on list endpoints
- Indexed tenant columns
- Transactional order/stock operations
- Idempotency for checkout/payment-sensitive operations
- Auditability for administrative changes

## 5. Success Criteria

The project is successful when:

1. Store A and Store B operate through the same API.
2. Store A admin cannot see Store B.
3. Store B admin cannot see Store A.
4. Platform Super Admin can manage stores globally.
5. Both admin roles use the same `/login`.
6. A storefront can be integrated using only its publishable key.
7. A trusted backend can integrate using its secret key.
8. A Postman collection can be handed to an external frontend/integration team.
