"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "cn"

export type SettingsSection = {
  id: string
  label: string
  description?: string
  icon?: LucideIcon
}

export function useSettingsSection(
  sections: SettingsSection[],
  defaultSection: string
) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const sectionIds = sections.map((item) => item.id)
  const raw = searchParams.get("section")
  const section =
    raw && sectionIds.includes(raw) ? raw : defaultSection

  function setSection(next: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (next === defaultSection) params.delete("section")
    else params.set("section", next)
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  return { section, setSection }
}

type SettingsSectionLayoutProps = {
  sections: SettingsSection[]
  defaultSection: string
  children: (section: string) => ReactNode
}

export function SettingsSectionLayout({
  sections,
  defaultSection,
  children,
}: SettingsSectionLayoutProps) {
  const { section, setSection } = useSettingsSection(sections, defaultSection)
  const active = sections.find((item) => item.id === section)

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-5">
      <nav
        aria-label="Settings sections"
        className="md:sticky md:top-20 md:w-52 md:shrink-0 lg:w-56"
      >
        <div className="admin-panel p-1.5 md:p-2">
          <p className="hidden px-2 pb-1.5 pt-0.5 text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase md:block">
            Sections
          </p>
          <div className="-mx-0.5 flex gap-1 overflow-x-auto px-0.5 pb-0.5 md:mx-0 md:flex-col md:gap-0.5 md:overflow-visible md:px-0 md:pb-0">
            {sections.map((item) => {
              const isActive = item.id === section
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setSection(item.id)}
                  className={cn(
                    "group relative flex shrink-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
                    isActive
                      ? "bg-primary/10 text-foreground shadow-sm ring-1 ring-primary/15"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  )}
                >
                  {isActive ? (
                    <span
                      aria-hidden
                      className="absolute top-1/2 left-0 hidden h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary md:block"
                    />
                  ) : null}
                  {Icon ? (
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-md transition-colors",
                        isActive
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground group-hover:bg-background group-hover:text-foreground"
                      )}
                    >
                      <Icon className="size-3.5" />
                    </span>
                  ) : null}
                  <span className="min-w-0">
                    <span className="block text-sm font-medium whitespace-nowrap">
                      {item.label}
                    </span>
                    {item.description ? (
                      <span className="mt-0.5 hidden text-xs leading-snug text-muted-foreground md:block">
                        {item.description}
                      </span>
                    ) : null}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </nav>

      <div className="min-w-0 flex-1">
        {active?.description ? (
          <div className="mb-3 border-b border-border/70 pb-2 md:hidden">
            <p className="text-sm font-medium text-foreground">{active.label}</p>
            <p className="text-sm text-muted-foreground">{active.description}</p>
          </div>
        ) : null}
        {children(section)}
      </div>
    </div>
  )
}
