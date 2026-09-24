import { describe, expect, it, vi } from "vitest";
import { DEFAULT_ZEPTOMAIL_API_URL } from "@/infrastructure/email/zeptomail";
import {
  buildOrderPlacedEmail,
  escapeHtml,
  formatInrPaise,
  notifyOrderPlaced,
} from "@/modules/checkout/order-placed-email";

const order = {
  id: "11111111-1111-1111-1111-111111111111",
  storeId: "22222222-2222-2222-2222-222222222222",
  orderNumber: "ORD-123",
  email: "guest@example.com",
  shippingName: "Asha <script>",
  grandTotalPaise: 249_900,
  items: [
    {
      productTitle: "Silk saree",
      variantTitle: "Red",
      quantity: 1,
      lineTotalPaise: 249_900,
    },
  ],
};

const config = {
  token: "test-send-mail-token",
  fromAddress: "orders@example.com",
  fromName: "Alora",
  apiUrl: DEFAULT_ZEPTOMAIL_API_URL,
};

describe("formatInrPaise", () => {
  it("formats integer paise as rupees", () => {
    expect(formatInrPaise(249_900)).toBe("₹2499.00");
    expect(formatInrPaise(1)).toBe("₹0.01");
    expect(formatInrPaise(0)).toBe("₹0.00");
  });
});

describe("buildOrderPlacedEmail", () => {
  it("includes the order number and escapes HTML", () => {
    const built = buildOrderPlacedEmail("Alora Fashion", order);
    expect(built.subject).toContain("ORD-123");
    expect(built.htmlbody).toContain("ORD-123");
    expect(built.htmlbody).toContain("₹2499.00");
    expect(built.htmlbody).toContain("Asha &lt;script&gt;");
    expect(built.htmlbody).not.toContain("<script>");
    expect(built.textbody).toContain("Silk saree");
  });

  it("escapes quotes", () => {
    expect(escapeHtml(`a"b`)).toBe("a&quot;b");
  });
});

describe("notifyOrderPlaced", () => {
  it("skips when ZeptoMail is not configured", async () => {
    const fetcher = vi.fn();
    await expect(
      notifyOrderPlaced({ config: null, storeName: "Alora", order, fetch: fetcher }),
    ).resolves.toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("skips when the order has no email", async () => {
    const fetcher = vi.fn();
    await expect(
      notifyOrderPlaced({
        config,
        storeName: "Alora",
        order: { ...order, email: null },
        fetch: fetcher,
      }),
    ).resolves.toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not throw when the provider fails", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("nope", { status: 500 }));
    await expect(
      notifyOrderPlaced({ config, storeName: "Alora", order, fetch: fetcher }),
    ).resolves.toBe(false);
  });

  it("sends when configured", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    await expect(
      notifyOrderPlaced({ config, storeName: "Alora Fashion", order, fetch: fetcher }),
    ).resolves.toBe(true);
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
