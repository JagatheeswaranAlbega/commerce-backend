import { and, asc, count, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/db/client";
import { customers } from "@/db/schema/customers";
import { orders } from "@/db/schema/orders";
import { ValidationError } from "@/shared/errors/app-error";
import { buildPaginationMeta, paginationOffset } from "@/shared/pagination/pagination";

export const MAX_SALES_REPORT_RANGE_DAYS = 366;

export type SalesReportRange = {
  from: Date;
  to: Date;
};

export type SalesReportSummary = {
  orderCount: number;
  salesPaise: number;
  averageOrderPaise: number;
};

export type SalesReportDaily = {
  date: string;
  orderCount: number;
  salesPaise: number;
};

export type SalesReportOrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: Date;
  subtotalPaise: number;
  discountTotalPaise: number;
  taxTotalPaise: number;
  shippingTotalPaise: number;
  grandTotalPaise: number;
  discountCode: string | null;
  customerId: string | null;
  customerEmail: string | null;
};

const EXCLUDED_SALES_STATUSES = ["CANCELLED", "REFUNDED"] as const;

export function parseSalesReportRange(
  fromRaw: string | undefined,
  toRaw: string | undefined,
  now: Date = new Date(),
): SalesReportRange {
  const to = toRaw ? parseBoundary(toRaw, "end") : endOfUtcDay(now);
  const from = fromRaw
    ? parseBoundary(fromRaw, "start")
    : startOfUtcDay(new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000));

  if (from.getTime() > to.getTime()) {
    throw new ValidationError("Report 'from' must be on or before 'to'.");
  }

  const spanMs = to.getTime() - from.getTime();
  const maxMs = MAX_SALES_REPORT_RANGE_DAYS * 24 * 60 * 60 * 1000;
  if (spanMs > maxMs) {
    throw new ValidationError(`Report range cannot exceed ${MAX_SALES_REPORT_RANGE_DAYS} days.`);
  }

  return { from, to };
}

function parseBoundary(raw: string, kind: "start" | "end"): Date {
  const trimmed = raw.trim();
  if (!trimmed) throw new ValidationError(`Invalid report ${kind} date.`);

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split("-").map(Number);
    if (kind === "start") return new Date(Date.UTC(y!, m! - 1, d!, 0, 0, 0, 0));
    return new Date(Date.UTC(y!, m! - 1, d!, 23, 59, 59, 999));
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError(`Invalid report ${kind} date.`);
  }
  return parsed;
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function endOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

export function computeSalesSummary(
  orderCount: number,
  salesPaise: number,
): SalesReportSummary {
  const safeCount = Math.max(0, orderCount);
  const safeSales = Math.max(0, salesPaise);
  return {
    orderCount: safeCount,
    salesPaise: safeSales,
    averageOrderPaise: safeCount === 0 ? 0 : Math.floor(safeSales / safeCount),
  };
}

function storeRangeClauses(storeId: string, from: Date, to: Date): SQL[] {
  return [
    eq(orders.storeId, storeId),
    gte(orders.createdAt, from),
    lte(orders.createdAt, to),
  ];
}

function salesEligibleClause(): SQL {
  return sql`${orders.status} not in ('CANCELLED', 'REFUNDED')`;
}

export async function loadSalesReport(
  db: Database,
  storeId: string,
  range: SalesReportRange,
  page = 1,
  pageSize = 50,
) {
  const base = storeRangeClauses(storeId, range.from, range.to);
  const salesWhere = and(...base, salesEligibleClause());

  const [summaryRow, dailyRows, orderTotalRow, orderRows] = await Promise.all([
    db
      .select({
        orderCount: count(),
        salesPaise: sql<number>`coalesce(sum(${orders.grandTotalPaise}), 0)`,
      })
      .from(orders)
      .where(salesWhere),
    db
      .select({
        date: sql<string>`(${orders.createdAt} at time zone 'UTC')::date`,
        orderCount: count(),
        salesPaise: sql<number>`coalesce(sum(${orders.grandTotalPaise}), 0)`,
      })
      .from(orders)
      .where(salesWhere)
      .groupBy(sql`(${orders.createdAt} at time zone 'UTC')::date`)
      .orderBy(asc(sql`(${orders.createdAt} at time zone 'UTC')::date`)),
    db.select({ total: count() }).from(orders).where(and(...base)),
    db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        createdAt: orders.createdAt,
        subtotalPaise: orders.subtotalPaise,
        discountTotalPaise: orders.discountTotalPaise,
        taxTotalPaise: orders.taxTotalPaise,
        shippingTotalPaise: orders.shippingTotalPaise,
        grandTotalPaise: orders.grandTotalPaise,
        discountCode: orders.discountCode,
        customerId: orders.customerId,
        customerEmail: customers.email,
      })
      .from(orders)
      .leftJoin(customers, eq(orders.customerId, customers.id))
      .where(and(...base))
      .orderBy(desc(orders.createdAt))
      .limit(pageSize)
      .offset(paginationOffset(page, pageSize)),
  ]);

  const summary = computeSalesSummary(
    Number(summaryRow[0]?.orderCount ?? 0),
    Number(summaryRow[0]?.salesPaise ?? 0),
  );

  const daily: SalesReportDaily[] = dailyRows.map((row) => ({
    date: String(row.date),
    orderCount: Number(row.orderCount ?? 0),
    salesPaise: Number(row.salesPaise ?? 0),
  }));

  const totalOrders = Number(orderTotalRow[0]?.total ?? 0);

  return {
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    summary,
    daily,
    orders: orderRows as SalesReportOrderRow[],
    pagination: buildPaginationMeta(page, pageSize, totalOrders),
  };
}

export async function loadSalesReportExportRows(
  db: Database,
  storeId: string,
  range: SalesReportRange,
): Promise<SalesReportOrderRow[]> {
  const base = storeRangeClauses(storeId, range.from, range.to);
  const rows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      createdAt: orders.createdAt,
      subtotalPaise: orders.subtotalPaise,
      discountTotalPaise: orders.discountTotalPaise,
      taxTotalPaise: orders.taxTotalPaise,
      shippingTotalPaise: orders.shippingTotalPaise,
      grandTotalPaise: orders.grandTotalPaise,
      discountCode: orders.discountCode,
      customerId: orders.customerId,
      customerEmail: customers.email,
    })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(and(...base))
    .orderBy(desc(orders.createdAt))
    .limit(10_000);

  return rows as SalesReportOrderRow[];
}

export function buildSalesCsv(rows: SalesReportOrderRow[]): string {
  // Human-facing INR amounts (rupees with 2 decimals), matching admin dashboard display.
  const header = [
    "orderNumber",
    "status",
    "createdAt",
    "subtotalInr",
    "discountTotalInr",
    "taxTotalInr",
    "shippingTotalInr",
    "grandTotalInr",
    "discountCode",
    "customerId",
    "customerEmail",
  ];

  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        csvEscape(row.orderNumber),
        csvEscape(row.status),
        csvEscape(row.createdAt.toISOString()),
        paiseToInrCsv(row.subtotalPaise),
        paiseToInrCsv(row.discountTotalPaise),
        paiseToInrCsv(row.taxTotalPaise),
        paiseToInrCsv(row.shippingTotalPaise),
        paiseToInrCsv(row.grandTotalPaise),
        csvEscape(row.discountCode ?? ""),
        csvEscape(row.customerId ?? ""),
        csvEscape(row.customerEmail ?? ""),
      ].join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

/** Format integer paise as rupees with 2 decimal places for CSV. */
export function paiseToInrCsv(paise: number): string {
  return (paise / 100).toFixed(2);
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export { EXCLUDED_SALES_STATUSES };
