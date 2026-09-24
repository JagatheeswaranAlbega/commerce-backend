import { and, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { globalProducts } from "@/db/schema/global-products";
import { globalProductVariants } from "@/db/schema/global-product-variants";
import { productVariants } from "@/db/schema/product-variants";
import { products } from "@/db/schema/products";
import { storeGlobalProducts } from "@/db/schema/store-global-products";
import type { CatalogItemSource } from "./global-catalog.types";

export type SellableVariant = {
  source: CatalogItemSource;
  variantId: string;
  productId: string;
  productTitle: string;
  productHandle: string;
  sku: string;
  title: string;
  pricePaise: number;
  compareAtPricePaise: number | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
};

/**
 * Resolve a variant that is sellable in a given store — either a local store
 * variant or an imported ACTIVE global variant.
 */
export async function findSellableVariant(
  db: Database,
  storeId: string,
  variantId: string,
): Promise<SellableVariant | null> {
  const local = await db
    .select({
      variant: productVariants,
      product: products,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(and(eq(productVariants.id, variantId), eq(productVariants.storeId, storeId)))
    .limit(1);

  if (local[0]) {
    const { variant, product } = local[0];
    return {
      source: "STORE",
      variantId: variant.id,
      productId: product.id,
      productTitle: product.title,
      productHandle: product.handle,
      sku: variant.sku,
      title: variant.title,
      pricePaise: variant.pricePaise,
      compareAtPricePaise: variant.compareAtPricePaise,
      status: variant.status,
    };
  }

  const global = await db
    .select({
      variant: globalProductVariants,
      product: globalProducts,
      association: storeGlobalProducts,
    })
    .from(globalProductVariants)
    .innerJoin(globalProducts, eq(globalProductVariants.productId, globalProducts.id))
    .innerJoin(
      storeGlobalProducts,
      and(
        eq(storeGlobalProducts.globalProductId, globalProducts.id),
        eq(storeGlobalProducts.storeId, storeId),
      ),
    )
    .where(eq(globalProductVariants.id, variantId))
    .limit(1);

  if (!global[0]) return null;

  const { variant, product, association } = global[0];
  if (
    association.status !== "ACTIVE" ||
    product.status !== "ACTIVE" ||
    variant.status !== "ACTIVE"
  ) {
    return null;
  }

  return {
    source: "GLOBAL",
    variantId: variant.id,
    productId: product.id,
    productTitle: product.title,
    productHandle: product.handle,
    sku: variant.sku,
    title: variant.title,
    pricePaise: variant.pricePaise,
    compareAtPricePaise: variant.compareAtPricePaise,
    status: variant.status,
  };
}

export async function listSellableVariantsForProduct(
  db: Database,
  storeId: string,
  productId: string,
  source: CatalogItemSource,
): Promise<SellableVariant[]> {
  if (source === "STORE") {
    const rows = await db
      .select({
        variant: productVariants,
        product: products,
      })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(
        and(
          eq(productVariants.storeId, storeId),
          eq(productVariants.productId, productId),
          eq(productVariants.status, "ACTIVE"),
        ),
      );
    return rows.map(({ variant, product }) => ({
      source: "STORE" as const,
      variantId: variant.id,
      productId: product.id,
      productTitle: product.title,
      productHandle: product.handle,
      sku: variant.sku,
      title: variant.title,
      pricePaise: variant.pricePaise,
      compareAtPricePaise: variant.compareAtPricePaise,
      status: variant.status,
    }));
  }

  const association = await db.query.storeGlobalProducts.findFirst({
    where: and(
      eq(storeGlobalProducts.storeId, storeId),
      eq(storeGlobalProducts.globalProductId, productId),
      eq(storeGlobalProducts.status, "ACTIVE"),
    ),
  });
  if (!association) return [];

  const rows = await db
    .select({
      variant: globalProductVariants,
      product: globalProducts,
    })
    .from(globalProductVariants)
    .innerJoin(globalProducts, eq(globalProductVariants.productId, globalProducts.id))
    .where(
      and(
        eq(globalProductVariants.productId, productId),
        eq(globalProductVariants.status, "ACTIVE"),
        eq(globalProducts.status, "ACTIVE"),
      ),
    );

  return rows.map(({ variant, product }) => ({
    source: "GLOBAL" as const,
    variantId: variant.id,
    productId: product.id,
    productTitle: product.title,
    productHandle: product.handle,
    sku: variant.sku,
    title: variant.title,
    pricePaise: variant.pricePaise,
    compareAtPricePaise: variant.compareAtPricePaise,
    status: variant.status,
  }));
}
