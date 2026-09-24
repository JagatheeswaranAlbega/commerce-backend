export const DEFAULT_ZEPTOMAIL_API_URL = "https://api.zeptomail.com/v1.1/email";

export type ZeptoMailConfig = {
  token: string;
  fromAddress: string;
  fromName?: string;
  apiUrl: string;
};

export type ZeptoMailEnvSource = {
  ZEPTOMAIL_TOKEN?: string;
  ZEPTOMAIL_FROM?: string;
  ZEPTOMAIL_FROM_NAME?: string;
  ZEPTOMAIL_API_URL?: string;
};

export type TransactionalEmailAddress = {
  address: string;
  name?: string;
};

export type SendTransactionalEmailInput = {
  to: TransactionalEmailAddress;
  subject: string;
  htmlbody: string;
  textbody?: string;
  replyTo?: TransactionalEmailAddress;
  clientReference?: string;
};

export class ZeptoMailError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ZeptoMailError";
    this.status = status;
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function resolveZeptoMailConfig(source: ZeptoMailEnvSource | undefined): ZeptoMailConfig | null {
  const token = source?.ZEPTOMAIL_TOKEN?.trim();
  const fromAddress = source?.ZEPTOMAIL_FROM?.trim();
  if (!token || !fromAddress || !EMAIL_PATTERN.test(fromAddress)) {
    return null;
  }

  const fromName = source?.ZEPTOMAIL_FROM_NAME?.trim();
  const apiUrl = source?.ZEPTOMAIL_API_URL?.trim() || DEFAULT_ZEPTOMAIL_API_URL;

  return {
    token,
    fromAddress,
    fromName: fromName || undefined,
    apiUrl,
  };
}

export function zeptoMailAuthorization(token: string): string {
  const trimmed = token.trim();
  if (/^zoho-enczapikey\s+/i.test(trimmed)) {
    return trimmed;
  }
  return `Zoho-enczapikey ${trimmed}`;
}

type FetchLike = typeof fetch;

export async function sendTransactionalEmail(
  config: ZeptoMailConfig,
  input: SendTransactionalEmailInput,
  fetcher: FetchLike = fetch,
): Promise<void> {
  const body: Record<string, unknown> = {
    from: { address: config.fromAddress, ...(config.fromName ? { name: config.fromName } : {}) },
    to: [{ email_address: { address: input.to.address, ...(input.to.name ? { name: input.to.name } : {}) } }],
    subject: input.subject,
    htmlbody: input.htmlbody,
  };
  if (input.textbody) body.textbody = input.textbody;
  if (input.replyTo) {
    body.reply_to = [{ address: input.replyTo.address, ...(input.replyTo.name ? { name: input.replyTo.name } : {}) }];
  }
  if (input.clientReference) body.client_reference = input.clientReference;

  const response = await fetcher(config.apiUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: zeptoMailAuthorization(config.token),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new ZeptoMailError("Transactional email provider rejected the request.", response.status);
  }
}
