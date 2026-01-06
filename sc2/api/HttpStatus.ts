// core/http/HttpTypes.ts

export type HttpRequestOptions = {
  params?: Record<string, any>;
  headers?: Record<string, string>;
  data?: any;
  timeout?: number;
  expectedStatus?: number;
};
