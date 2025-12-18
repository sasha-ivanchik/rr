import { Browser, BrowserContext, Page } from "@playwright/test";

export interface AppSession {
  appName: string;
  env: string;
  source: "parent" | "child" | "external";

  browser: Browser;
  context: BrowserContext;
  page: Page;

  connectedAt: number;
}
