const CATEGORY_BLURBS: Record<string, string> = {
  sarees:
    "Timeless elegance — from Banarasi silks to Kanjeevaram and Chanderi weaves",
  lehengas: "Bridal and festive lehengas crafted for life's grandest moments",
  kurtas: "Everyday ethnic charm — chikankari, linen, and cotton kurtas",
  "suits-and-sets":
    "Flowing silhouettes and fine embroidery for every occasion",
}

const CATEGORY_NAV_ORDER = ["sarees", "lehengas", "kurtas", "suits-and-sets"]

export function categoryBlurb(slug: string): string {
  return CATEGORY_BLURBS[slug] ?? "Explore our curated pieces"
}

export function sortShopCategories<T extends { slug: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aIndex = CATEGORY_NAV_ORDER.indexOf(a.slug)
    const bIndex = CATEGORY_NAV_ORDER.indexOf(b.slug)
    const aRank = aIndex === -1 ? CATEGORY_NAV_ORDER.length : aIndex
    const bRank = bIndex === -1 ? CATEGORY_NAV_ORDER.length : bIndex
    if (aRank !== bRank) return aRank - bRank
    return a.slug.localeCompare(b.slug)
  })
}
