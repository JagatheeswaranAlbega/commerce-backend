import type { GlobalCategory } from "@/lib/api/platform/global-catalog"

export function globalCategoryById(categories: GlobalCategory[]) {
  return new Map(categories.map((category) => [category.id, category]))
}

/** Product/filter labels use the top-level name only (e.g. Jewellery, not Jewellery / Anklets). */
export function globalCategoryLabel(
  category: GlobalCategory,
  byId: Map<string, GlobalCategory>
) {
  if (!category.parentId) return category.name
  return byId.get(category.parentId)?.name ?? category.name
}

export function topLevelCategoryId(
  categoryId: string | null | undefined,
  byId: Map<string, GlobalCategory>
) {
  if (!categoryId) return ""
  const category = byId.get(categoryId)
  if (!category) return categoryId
  return category.parentId ?? category.id
}

export function sortGlobalCategories(categories: GlobalCategory[]) {
  const byParent = new Map<string | null, GlobalCategory[]>()
  for (const category of categories) {
    const list = byParent.get(category.parentId) ?? []
    list.push(category)
    byParent.set(category.parentId, list)
  }
  const ordered: GlobalCategory[] = []
  const seen = new Set<string>()

  function walk(parentId: string | null) {
    const children = (byParent.get(parentId) ?? [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
    for (const child of children) {
      if (seen.has(child.id)) continue
      seen.add(child.id)
      ordered.push(child)
      walk(child.id)
    }
  }

  walk(null)
  for (const category of categories) {
    if (seen.has(category.id)) continue
    seen.add(category.id)
    ordered.push(category)
  }
  return ordered
}

export function globalCategorySelectOptions(categories: GlobalCategory[]) {
  return sortGlobalCategories(categories)
    .filter((category) => !category.parentId)
    .map((category) => ({
      value: category.id,
      label: category.name,
    }))
}
