import { redirect } from "next/navigation"

export default function AdminReturnsRedirect() {
  redirect("/admin/orders?status=REFUNDED")
}
