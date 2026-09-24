import type { LucideIcon } from "lucide-react"
import {
  FolderTree,
  Globe2,
  KeyRound,
  LayoutDashboard,
  Layers,
  Package,
  Percent,
  ScrollText,
  Settings,
  ShoppingBag,
  Store,
  UserCog,
  Users,
  Warehouse,
  ChartColumn,
} from "lucide-react"

import type { Permission } from "@/lib/permissions"

export type AdminNavGroupId =
  | "overview"
  | "platform"
  | "catalog"
  | "commerce"
  | "system"

export type AdminNavItem = {
  href: string
  label: string
  icon: LucideIcon
  permission: Permission
  group: AdminNavGroupId
}

export const ADMIN_NAV_GROUPS: {
  id: AdminNavGroupId
  label: string
}[] = [
  { id: "overview", label: "Overview" },
  { id: "platform", label: "Platform" },
  { id: "catalog", label: "Catalog" },
  { id: "commerce", label: "Commerce" },
  { id: "system", label: "System" },
]

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
    permission: "dashboard.read",
    group: "overview",
  },
  {
    href: "/admin/reports",
    label: "Reports",
    icon: ChartColumn,
    permission: "dashboard.read",
    group: "overview",
  },
  {
    href: "/admin/stores",
    label: "Stores",
    icon: Store,
    permission: "stores.read",
    group: "platform",
  },
  {
    href: "/admin/store-admins",
    label: "Store Admins",
    icon: UserCog,
    permission: "store_admins.read",
    group: "platform",
  },
  {
    href: "/admin/audit-logs",
    label: "Audit Logs",
    icon: ScrollText,
    permission: "audit_logs.read",
    group: "platform",
  },
  {
    href: "/admin/products",
    label: "Products",
    icon: Package,
    permission: "products.read",
    group: "catalog",
  },
  {
    href: "/admin/global-catalog",
    label: "Global Catalog",
    icon: Globe2,
    permission: "global_catalog.read",
    group: "catalog",
  },
  {
    href: "/admin/categories",
    label: "Categories",
    icon: FolderTree,
    permission: "categories.read",
    group: "catalog",
  },
  {
    href: "/admin/collections",
    label: "Collections",
    icon: Layers,
    permission: "collections.read",
    group: "catalog",
  },
  {
    href: "/admin/inventory",
    label: "Inventory",
    icon: Warehouse,
    permission: "inventory.read",
    group: "catalog",
  },
  {
    href: "/admin/orders",
    label: "Orders",
    icon: ShoppingBag,
    permission: "orders.read",
    group: "commerce",
  },
  {
    href: "/admin/discounts",
    label: "Discounts",
    icon: Percent,
    permission: "discounts.read",
    group: "commerce",
  },
  {
    href: "/admin/customers",
    label: "Customers",
    icon: Users,
    permission: "customers.read",
    group: "commerce",
  },
  {
    href: "/admin/keys",
    label: "API Keys",
    icon: KeyRound,
    permission: "api_keys.read",
    group: "commerce",
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: Settings,
    permission: "settings.read",
    group: "system",
  },
]
