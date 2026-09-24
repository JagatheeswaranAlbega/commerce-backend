import { describe, expect, it } from "vitest";
import {
  resolveMediaContentType,
  sniffImageContentType,
} from "@/infrastructure/r2/product-media";

function jpegBytes(): ArrayBuffer {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]).buffer;
}

function pngBytes(): ArrayBuffer {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer;
}

describe("product media content type", () => {
  it("sniffs jpeg and png magic bytes", () => {
    expect(sniffImageContentType(jpegBytes())).toBe("image/jpeg");
    expect(sniffImageContentType(pngBytes())).toBe("image/png");
  });

  it("prefers sniffed type over a wrong declared type", () => {
    expect(resolveMediaContentType("image/png", jpegBytes())).toBe("image/jpeg");
    expect(resolveMediaContentType("application/octet-stream", pngBytes())).toBe(
      "image/png",
    );
  });
});
