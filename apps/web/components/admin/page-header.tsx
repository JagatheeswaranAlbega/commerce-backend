import { Fragment, type ReactNode } from "react"

import { GuardedLink } from "@/components/admin/navigation-guard"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

export type AdminBreadcrumb = {
  label: string
  href?: string
}

type AdminPageHeaderProps = {
  title: string
  description?: string
  breadcrumbs?: AdminBreadcrumb[]
  actions?: ReactNode
}

function visibleBreadcrumbs(
  breadcrumbs: AdminBreadcrumb[] | undefined,
  title: string
): AdminBreadcrumb[] {
  if (!breadcrumbs || breadcrumbs.length === 0) return []
  const last = breadcrumbs[breadcrumbs.length - 1]
  // Last crumb that only repeats the page title — drop it (the h1 already shows it).
  const trimmed =
    !last.href && last.label === title
      ? breadcrumbs.slice(0, -1)
      : breadcrumbs
  if (
    trimmed.length === 1 &&
    !trimmed[0].href &&
    trimmed[0].label === title
  ) {
    return []
  }
  return trimmed
}

export function AdminPageHeader({
  title,
  description,
  breadcrumbs,
  actions,
}: AdminPageHeaderProps) {
  const crumbs = visibleBreadcrumbs(breadcrumbs, title)

  return (
    <div className="flex flex-col gap-1 sm:gap-3">
      {crumbs.length > 0 ? (
        <Breadcrumb>
          <BreadcrumbList>
            {crumbs.map((crumb, index) => {
              return (
                <Fragment key={`${crumb.label}-${index}`}>
                  {index > 0 ? <BreadcrumbSeparator /> : null}
                  <BreadcrumbItem>
                    {crumb.href ? (
                      <BreadcrumbLink
                        render={<GuardedLink href={crumb.href} />}
                      >
                        {crumb.label}
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-3 sm:gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {description ? (
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  )
}
