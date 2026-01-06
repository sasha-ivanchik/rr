// core/http/HttpContext.ts

import { APIRequestContext, request } from "@playwright/test";

export class HttpContext {
  private static context: APIRequestContext;

  static async get(): Promise<APIRequestContext> {
    if (!this.context) {
      this.context = await request.newContext({
        ignoreHTTPSErrors: true,
      });
    }
    return this.context;
  }
}
