import {
  resolveZeptoMailConfig,
  sendTransactionalEmail,
  type ZeptoMailConfig,
  type ZeptoMailEnvSource,
} from "@/infrastructure/email/zeptomail";
import { safeErrorMessage } from "@/shared/logging/redact";

export type OrderPlacedEmailItem = {
  productTitle: string;
  variantTitle: string;
  quantity: number;
  lineTotalPaise: number;
};

export type OrderPlacedEmailOrder = {
  id: string;
  storeId: string;
  orderNumber: string;
  email: string | null;
  shippingName: string;
  grandTotalPaise: number;
  items: OrderPlacedEmailItem[];
};

export type OrderPlacedEmailInput = {
  config: ZeptoMailConfig | null;
  storeName: string;
  replyTo?: string | null;
  order: OrderPlacedEmailOrder;
  fetch?: typeof fetch;
};

/** Integer paise → display rupees. No floating-point money math. */
export function formatInrPaise(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(paise));
  const rupees = Math.floor(abs / 100);
  const remainder = abs % 100;
  return `${sign}₹${rupees}.${String(remainder).padStart(2, "0")}`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function zeptoMailConfigFromEnv(
  env: ZeptoMailEnvSource | undefined,
  fallback: ZeptoMailEnvSource = process.env,
): ZeptoMailConfig | null {
  return resolveZeptoMailConfig({
    ZEPTOMAIL_TOKEN: env?.ZEPTOMAIL_TOKEN || fallback.ZEPTOMAIL_TOKEN,
    ZEPTOMAIL_FROM: env?.ZEPTOMAIL_FROM || fallback.ZEPTOMAIL_FROM,
    ZEPTOMAIL_FROM_NAME: env?.ZEPTOMAIL_FROM_NAME || fallback.ZEPTOMAIL_FROM_NAME,
    ZEPTOMAIL_API_URL: env?.ZEPTOMAIL_API_URL || fallback.ZEPTOMAIL_API_URL,
  });
}

export function buildOrderPlacedEmail(storeName: string, order: OrderPlacedEmailOrder) {
  const greetingName = order.shippingName.trim() || "there";
  const subject = `${storeName}: order ${order.orderNumber} has been placed`;
  const itemLines = order.items.map((item) => {
    const title = `${item.productTitle}${item.variantTitle ? ` (${item.variantTitle})` : ""}`;
    return `${item.quantity} × ${title} — ${formatInrPaise(item.lineTotalPaise)}`;
  });
  const textbody = [
    `Hi ${greetingName},`,
    "",
    `Your order ${order.orderNumber} has been placed.`,
    "",
    ...itemLines,
    "",
    `Total: ${formatInrPaise(order.grandTotalPaise)}`,
    "",
    "We will update you when it ships.",
    "",
    storeName,
  ].join("\n");

  const itemRows = order.items
    .map((item) => {
      const title = `${escapeHtml(item.productTitle)}${
        item.variantTitle ? ` (${escapeHtml(item.variantTitle)})` : ""
      }`;
      return `<tr><td>${item.quantity} × ${title}</td><td>${formatInrPaise(item.lineTotalPaise)}</td></tr>`;
    })
    .join("");

  const htmlbody = `<p>Hi ${escapeHtml(greetingName)},</p>
<p>Your order <strong>${escapeHtml(order.orderNumber)}</strong> has been placed.</p>
<table>${itemRows}</table>
<p><strong>Total: ${formatInrPaise(order.grandTotalPaise)}</strong></p>
<p>We will update you when it ships.</p>
<p>${escapeHtml(storeName)}</p>`;

  return { subject, htmlbody, textbody };
}

export async function notifyOrderPlaced(input: OrderPlacedEmailInput): Promise<boolean> {
  const to = input.order.email?.trim();
  if (!input.config || !to) {
    return false;
  }

  const { subject, htmlbody, textbody } = buildOrderPlacedEmail(input.storeName, input.order);
  const replyTo = input.replyTo?.trim();

  try {
    await sendTransactionalEmail(
      input.config,
      {
        to: { address: to, name: input.order.shippingName || undefined },
        subject,
        htmlbody,
        textbody,
        replyTo: replyTo ? { address: replyTo, name: input.storeName } : undefined,
        clientReference: input.order.id,
      },
      input.fetch,
    );
    return true;
  } catch (error) {
    console.error("Order confirmation email failed.", {
      orderId: input.order.id,
      storeId: input.order.storeId,
      message: safeErrorMessage(error),
    });
    return false;
  }
}
