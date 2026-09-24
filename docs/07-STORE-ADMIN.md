# Store Admin — Sidebar, Screens and Flows

## 1. Login

Store Admin uses the same:

```text
/login
```

After login:

```text
role = STORE_ADMIN
storeId = Store A
```

The dashboard is automatically scoped to that store.

## 2. Store Admin Sidebar

Recommended menu:

```text
Dashboard

Reports

Catalog
  ├── Products
  ├── Global Catalog
  ├── Categories
  └── Collections

Inventory

Orders
  ├── All Orders
  ├── Pending
  ├── Processing
  ├── Shipped
  └── Completed

Returns
  ├── Requested
  ├── Approved (restock)
  └── Rejected

Customers

Discounts

Media

Store Settings

API / Integrations
```

The exact menu can be reduced for the MVP.

## 3. Dashboard

Dashboard only displays Store A data.

Examples:

- Store A product count
- Store A order count
- Store A sales
- Store A inventory alerts

Never show Store B metrics.

**Reports** (`/admin/reports`): date-range sales summary, daily breakdown, and CSV export for the authenticated store only. Cancelled/returned orders are excluded from sales KPIs but included in the CSV for audit.

## 4. Product Flow

```text
Products
 ↓
Create Product
 ↓
Product information + media
 ↓
Add variants (SKU, price, compare-at, initial stock)
 ↓
Publish (ACTIVE)
 ↓
Visible on headless storefront:
  GET /api/v1/store/products
  GET /api/v1/store/products/:handle
  (header x-publishable-key)
```

Stock can also be adjusted later under Inventory. Only ACTIVE products (and ACTIVE variants) appear on the storefront API — there is no shop UI in `apps/web`.

## 5. Product Update

```text
Open product
 ↓
Update
 ↓
Validate product belongs to current store
 ↓
Save
```

## 6. Inventory Flow

```text
Inventory
 ↓
Select variant
 ↓
View current stock
 ↓
Adjust stock
 ↓
Record adjustment
 ↓
Update inventory
```

## 7. Order Flow

```text
New customer checkout
 ↓
Store A order created
 ↓
Store A admin sees order
 ↓
Review
 ↓
Process
 ↓
Fulfill
 ↓
Ship
 ↓
Complete
 ↓
Customer may request return (delivered only)
 ↓
Store admin approve → restock (no payment refund)
 or reject → order stays delivered
```

Store B admin must never see this order.

## 8. Discounts

Store Admin can create percentage or fixed codes with optional:

- Start / end schedule
- Minimum order (paise)
- Total usage limit

Rules are enforced when customers apply a code and at checkout. Usage count increases only after a successful order. Payments remain out of scope. Order-placed email is sent after checkout when ZeptoMail is configured.

## 9. Customer Flow

Store Admin can view only customers associated with the current store, according to the final customer model.

## 10. Store Settings

Possible settings:

- Store name
- Store status
- Contact information
- Storefront configuration
- API integration settings
- Media settings

## 11. Tenant Rule

The Store Admin does not choose which store to operate by sending a `storeId`.

The authenticated identity already has a fixed store scope.

```text
JWT storeId
     ↓
request context
     ↓
service
     ↓
repository
     ↓
WHERE store_id = context.storeId
```
