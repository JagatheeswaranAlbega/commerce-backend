import { and, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { productVariants } from "@/db/schema/product-variants";
import type {
  CreateVariantInput,
  UpdateVariantInput,
  VariantRecord,
} from "@/modules/variant/variant.types";

function toRecord(row: typeof productVariants.$inferSelect): VariantRecord {
  return {
    id: row.id,
    storeId: row.storeId,
    productId: row.productId,
    sku: row.sku,
    title: row.title,
    pricePaise: row.pricePaise,
    compareAtPricePaise: row.compareAtPricePaise,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class VariantRepository {
  constructor(private readonly db: Database) {}

  async findByStoreAndId(storeId: string, id: string): Promise<VariantRecord | null> {
    const row = await this.db.query.productVariants.findFirst({
      where: and(eq(productVariants.id, id), eq(productVariants.storeId, storeId)),
    });
    return row ? toRecord(row) : null;
  }

  async listByProduct(storeId: string, productId: string): Promise<VariantRecord[]> {
    const rows = await this.db.query.productVariants.findMany({
      where: and(eq(productVariants.storeId, storeId), eq(productVariants.productId, productId)),
    });
    return rows.map(toRecord);
  }

  async findBySku(storeId: string, sku: string): Promise<VariantRecord | null> {
    const row = await this.db.query.productVariants.findFirst({
      where: and(eq(productVariants.storeId, storeId), eq(productVariants.sku, sku)),
    });
    return row ? toRecord(row) : null;
  }

  async create(
    storeId: string,
    productId: string,
    input: CreateVariantInput,
  ): Promise<VariantRecord> {
    const [row] = await this.db
      .insert(productVariants)
      .values({
        storeId,
        productId,
        sku: input.sku,
        title: input.title,
        pricePaise: input.pricePaise,
        compareAtPricePaise: input.compareAtPricePaise ?? null,
        status: input.status ?? "DRAFT",
      })
      .returning();
    return toRecord(row!);
  }

  async update(
    storeId: string,
    id: string,
    input: UpdateVariantInput,
  ): Promise<VariantRecord | null> {
    const [row] = await this.db
      .update(productVariants)
      .set({
        ...(input.sku !== undefined ? { sku: input.sku } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.pricePaise !== undefined ? { pricePaise: input.pricePaise } : {}),
        ...(input.compareAtPricePaise !== undefined
          ? { compareAtPricePaise: input.compareAtPricePaise }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(productVariants.id, id), eq(productVariants.storeId, storeId)))
      .returning();
    return row ? toRecord(row) : null;
  }

  async delete(storeId: string, id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(productVariants)
      .where(and(eq(productVariants.id, id), eq(productVariants.storeId, storeId)))
      .returning({ id: productVariants.id });
    return deleted.length > 0;
  }
}
