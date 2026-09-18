import { cn } from "cn"

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function ProductSectionCard({
  title,
  action,
  children,
  className,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card
      size="sm"
      className={cn(
        "rounded-xl shadow-none ring-1 ring-border/80 [--card-spacing:--spacing(4)]",
        className
      )}
    >
      <CardHeader className="border-b">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
