// core/http/HttpResult.ts

import { APIResponse } from "@playwright/test";

export class HttpResult<T = any> {
  constructor(
    public status: number,
    public ok: boolean,
    public body: T | null,
    public response: APIResponse
  ) {}

  expectStatus(expected: number) {
    if (this.status !== expected) {
      throw new Error(
        `Expected status ${expected}, but got ${this.status}`
      );
    }
  }
}
