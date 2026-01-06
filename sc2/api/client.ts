// core/http/HttpClient.ts

import { APIResponse } from "@playwright/test";
import { HttpContext } from "./HttpContext";
import { HttpRequestOptions } from "./HttpTypes";
import { HttpResult } from "./HttpResult";

class HttpClient {
  async get<T = any>(url: string, options: HttpRequestOptions = {}) {
    return this.request<T>("get", url, options);
  }

  async post<T = any>(url: string, options: HttpRequestOptions = {}) {
    return this.request<T>("post", url, options);
  }

  async put<T = any>(url: string, options: HttpRequestOptions = {}) {
    return this.request<T>("put", url, options);
  }

  async delete<T = any>(url: string, options: HttpRequestOptions = {}) {
    return this.request<T>("delete", url, options);
  }

  private async request<T>(
    method: "get" | "post" | "put" | "delete",
    url: string,
    options: HttpRequestOptions
  ): Promise<HttpResult<T>> {
    const ctx = await HttpContext.get();

    const response: APIResponse = await ctx[method](url, {
      params: options.params,
      headers: options.headers,
      data: options.data,
      timeout: options.timeout,
    });

    let body: T | null = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    const result = new HttpResult<T>(
      response.status(),
      response.ok(),
      body,
      response
    );

    if (options.expectedStatus !== undefined) {
      result.expectStatus(options.expectedStatus);
    }

    return result;
  }
}

export const httpClient = new HttpClient();
