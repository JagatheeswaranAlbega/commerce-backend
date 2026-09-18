# Platform Super Admin — Sidebar, Screens and Flows

## 1. Login

Platform Super Admin uses the same:

```text
/login
```

as Store Admin.

After authentication:

```text
role = PLATFORM_SUPER_ADMIN
storeId = null
```

Frontend routes to the Platform console.

## 2. Platform Sidebar

Recommended menu:

```text
Dashboard

Stores
  ├── All Stores
  ├── Create Store
  └── Store Details

Store Admins
  ├── All Admins
  └── Create Admin

Catalog
  ├── Products
  ├── Categories
  └── Collections

Orders

API Keys
  ├── Publishable Keys
  └── Secret Keys

Customers

Analytics / Metrics

Audit Logs

Settings
```

## 3. Dashboard Flow

```text
Login
 ↓
Identify PLATFORM_SUPER_ADMIN
 ↓
Platform Dashboard
 ↓
Global metrics
 ↓
Store count
 ↓
Admin count
 ↓
Product/order summaries
```

## 4. Store Creation Flow

```text
Stores
 ↓
Create Store
 ↓
Store name + slug + configuration
 ↓
Create store
 ↓
Create Store Admin
 ↓
Generate credentials/keys
 ↓
Store becomes available
```

## 5. Store Details Flow

Platform Admin can inspect:

- store information
- store status
- admin accounts
- API credentials metadata
- products
- orders
- metrics

## 6. Store Admin Provisioning

```text
Platform Admin
 ↓
Select Store A
 ↓
Create Store Admin
 ↓
Email/password setup
 ↓
Assign storeId = Store A
 ↓
Store Admin can only operate Store A
```

## 7. API Key Flow

Platform Admin creates/rotates:

```text
Publishable Key
Secret Key
```

Publishable key can be shared with storefront developers.

Secret key is shown only at creation time and stored as a hash.

## 8. Global Access

Platform Admin can operate globally only through explicit platform authorization.

A Platform Admin request is not the same as a Store Admin request.

## 9. Important Security Rule

Never implement:

```text
if storeId == null => unrestricted
```

as a generic authorization shortcut.

Use explicit:

```text
role == PLATFORM_SUPER_ADMIN
```

authorization.
