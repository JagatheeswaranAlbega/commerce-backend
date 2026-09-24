import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_ZEPTOMAIL_API_URL,
  resolveZeptoMailConfig,
  sendTransactionalEmail,
  zeptoMailAuthorization,
} from "@/infrastructure/email/zeptomail";

const config = {
  token: "test-send-mail-token",
  fromAddress: "orders@example.com",
  fromName: "Demo Store",
  apiUrl: DEFAULT_ZEPTOMAIL_API_URL,
};

describe("resolveZeptoMailConfig", () => {
  it("returns null when token or from is missing", () => {
    expect(resolveZeptoMailConfig({})).toBeNull();
    expect(resolveZeptoMailConfig({ ZEPTOMAIL_TOKEN: "abc" })).toBeNull();
    expect(resolveZeptoMailConfig({ ZEPTOMAIL_FROM: "orders@example.com" })).toBeNull();
    expect(
      resolveZeptoMailConfig({ ZEPTOMAIL_TOKEN: "abc", ZEPTOMAIL_FROM: "not-an-email" }),
    ).toBeNull();
  });

  it("accepts a valid token and from address", () => {
    expect(
      resolveZeptoMailConfig({
        ZEPTOMAIL_TOKEN: " abc ",
        ZEPTOMAIL_FROM: "orders@example.com",
        ZEPTOMAIL_FROM_NAME: "Orders",
      }),
    ).toEqual({
      token: "abc",
      fromAddress: "orders@example.com",
      fromName: "Orders",
      apiUrl: DEFAULT_ZEPTOMAIL_API_URL,
    });
  });
});

describe("zeptoMailAuthorization", () => {
  it("prefixes a raw send-mail token", () => {
    expect(zeptoMailAuthorization("raw-token")).toBe("Zoho-enczapikey raw-token");
  });

  it("keeps an already-prefixed token", () => {
    expect(zeptoMailAuthorization("Zoho-enczapikey already")).toBe("Zoho-enczapikey already");
  });
});

describe("sendTransactionalEmail", () => {
  it("posts JSON to ZeptoMail without throwing on 2xx", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    await sendTransactionalEmail(
      config,
      {
        to: { address: "guest@example.com", name: "Guest" },
        subject: "Order placed",
        htmlbody: "<p>Hi</p>",
        textbody: "Hi",
        clientReference: "order-1",
      },
      fetcher,
    );

    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(DEFAULT_ZEPTOMAIL_API_URL);
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Zoho-enczapikey test-send-mail-token",
    );
    const payload = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(payload.subject).toBe("Order placed");
    expect(payload.client_reference).toBe("order-1");
    expect(JSON.stringify(init.body)).not.toContain("test-send-mail-token");
  });

  it("throws a provider error without including the token", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("denied", { status: 401 }));
    await expect(
      sendTransactionalEmail(
        config,
        { to: { address: "guest@example.com" }, subject: "X", htmlbody: "<p>X</p>" },
        fetcher,
      ),
    ).rejects.toThrow("Transactional email provider rejected the request.");
  });
});
