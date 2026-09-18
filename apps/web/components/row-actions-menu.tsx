"use client"

import { Menu } from "@base-ui/react/menu"
import { MoreHorizontal } from "lucide-react"
import { cn } from "cn"

import { buttonVariants } from "@/components/ui/button"

export type RowActionsMenuItem = {
  label: string
  onClick: () => void
  disabled?: boolean
  variant?: "default" | "destructive"
}

type RowActionsMenuProps = {
  label: string
  items: RowActionsMenuItem[]
}

export function RowActionsMenu({ label, items }: RowActionsMenuProps) {
  if (items.length === 0) return null

  return (
    <div className="flex justify-end">
      <Menu.Root>
        <Menu.Trigger
          aria-label={label}
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon-sm" }),
            "shrink-0"
          )}
        >
          <MoreHorizontal className="size-4" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner
            side="bottom"
            align="end"
            sideOffset={4}
            className="z-50"
          >
            <Menu.Popup className="min-w-40 rounded-lg border border-border/80 bg-popover p-1 shadow-lg outline-none">
              {items.map((item) => (
                <Menu.Item
                  key={item.label}
                  disabled={item.disabled}
                  className={cn(
                    "flex cursor-default rounded-md px-3 py-1.5 text-sm outline-none select-none data-highlighted:bg-muted data-disabled:pointer-events-none data-disabled:opacity-50",
                    item.variant === "destructive" &&
                      "text-destructive data-highlighted:bg-destructive/10"
                  )}
                  onClick={item.onClick}
                >
                  {item.label}
                </Menu.Item>
              ))}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  )
}
