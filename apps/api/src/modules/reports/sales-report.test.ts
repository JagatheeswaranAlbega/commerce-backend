import { describe, expect, it } from "vitest";
import {
  computeSalesSummary,
  parseSalesReportRange,
} from "./sales-report";
import { ValidationError } from "@/shared/errors/app-error";

describe("parseSalesReportRange", () => {
  const now = new Date("2026-06-15T12:00:00.000Z");

  it("defaults to last 30 UTC days ending today when omitted", () => {
    const range = parseSalesReportRange(undefined, undefined, now);
    expect(range.to.toISOString()).toBe("2026-06-15T23:59:59.999Z");
    expect(range.from.toISOString()).toBe("2026-05-17T00:00:00.000Z");
  });

  it("parses YYYY-MM-DD as inclusive UTC day bounds", () => {
    const range = parseSalesReportRange("2026-01-01", "2026-01-31", now);
    expect(range.from.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-01-31T23:59:59.999Z");
  });

  it("rejects from after to", () => {
    expect(() => parseSalesReportRange("2026-02-01", "2026-01-01", now)).toThrow(
      ValidationError,
    );
  });

  it("rejects ranges longer than 366 days", () => {
    expect(() => parseSalesReportRange("2024-01-01", "2026-01-10", now)).toThrow(
      /366/,
    );
  });
});

describe("computeSalesSummary", () => {
  it("computes AOV floored in paise", () => {
    expect(computeSalesSummary(3, 10_000)).toEqual({
      orderCount: 3,
      salesPaise: 10_000,
      averageOrderPaise: 3_333,
    });
  });

  it("returns zero AOV when there are no orders", () => {
    expect(computeSalesSummary(0, 0)).toEqual({
      orderCount: 0,
      salesPaise: 0,
      averageOrderPaise: 0,
    });
  });
});

describe("paiseToInrCsv", () => {
  it("formats paise as rupees with 2 decimals", async () => {
    const { paiseToInrCsv } = await import("./sales-report");
    expect(paiseToInrCsv(249_900)).toBe("2499.00");
    expect(paiseToInrCsv(0)).toBe("0.00");
    expect(paiseToInrCsv(1)).toBe("0.01");
  });
});
