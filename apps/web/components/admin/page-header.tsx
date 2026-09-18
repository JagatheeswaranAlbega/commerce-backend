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

function shouldShowBreadcrumbs(
  breadcrumbs: AdminBreadcrumb[] | undefined,
  title: string
): breadcrumbs is AdminBreadcrumb[] {
  if (!breadcrumbs || breadcrumbs.length === 0) return false
  // Single crumb that only repeats the page title — hide (no navigation value).
  if (
    breadcrumbs.length === 1 &&
    !breadcrumbs[0].href &&
    breadcrumbs[0].label === title
  ) {
    return false
  }
  return true
}

export function AdminPageHeader({
  title,
  description,
  breadcrumbs,
  actions,
}: AdminPageHeaderProps) {
  const showBreadcrumbs = shouldShowBreadcrumbs(breadcrumbs, title)

  return (
    <div className="flex flex-col gap-1 sm:gap-3">
      {showBreadcrumbs ? (
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1
              return (
                <Fragment key={`${crumb.label}-${index}`}>
                  {index > 0 ? <BreadcrumbSeparator /> : null}
                  <BreadcrumbItem>
                    {isLast || !crumb.href ? (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink
                        render={<GuardedLink href={crumb.href} />}
                      >
                        {crumb.label}
                      </BreadcrumbLink>
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
