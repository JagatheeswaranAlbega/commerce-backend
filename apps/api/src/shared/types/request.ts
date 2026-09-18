export type RequestId = string;

export type ApiHandlerContext = {
  requestId: RequestId;
  params: Record<string, string>;
};
