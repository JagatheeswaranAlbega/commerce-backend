import { describe, expect, it } from "vitest";
import {
  assertJewelleryImageContract,
  JEWELLERY_CHILD_CATEGORIES,
  JEWELLERY_PRODUCTS,
} from "./jewellery-catalog";

describe("jewellery catalog contract", () => {
  it("has 16 products, 8 children, and unique name-matched image pairs", () => {
    expect(JEWELLERY_CHILD_CATEGORIES).toHaveLength(8);
    expect(JEWELLERY_PRODUCTS).toHaveLength(16);
    expect(() => assertJewelleryImageContract()).not.toThrow();

    const handles = new Set<string>();
    const files = new Set<string>();
    for (const product of JEWELLERY_PRODUCTS) {
      expect(handles.has(product.handle)).toBe(false);
      handles.add(product.handle);
      expect(product.imageFiles).toEqual([
        `${product.handle}-front.png`,
        `${product.handle}-angle.png`,
      ]);
      for (const file of product.imageFiles) {
        expect(files.has(file)).toBe(false);
        files.add(file);
      }
      expect(product.imagePrompts[0]).toContain(product.title);
      expect(product.imagePrompts[1]).toContain(product.title);
    }
    expect(files.size).toBe(32);
  });
});
