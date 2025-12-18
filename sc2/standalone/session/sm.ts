import { chromium } from "@playwright/test";
import { registry } from "../registry/Registry";
import { AppSession } from "./AppSession";
import { isSessionAlive } from "./health";

export class SessionManager {
  private session: AppSession | null = null;

  constructor(
    private readonly appName: string,
    private readonly env: string
  ) {}

  async get(): Promise<AppSession> {
    if (
      this.session &&
      (await isSessionAlive(this.session.page))
    ) {
      return this.session;
    }

    this.session = await this.attachFromRegistry();
    return this.session;
  }

  private async attachFromRegistry(): Promise<AppSession> {
    const info = registry.getApp({
      appName: this.appName,
      env: this.env,
    });

    if (!info) {
      throw new Error(
        `App "${this.appName}" (${this.env}) not found in registry`
      );
    }

    const browser = await chromium.connectOverCDP(
      info.wsEndpoint
    );

    const context = browser.contexts()[0];
    if (!context) {
      throw new Error("No browser context found");
    }

    const page = context.pages()[0];
    if (!page) {
      throw new Error("No page found in browser context");
    }

    return {
      appName: info.appName,
      env: info.env,
      source: info.source,

      browser,
      context,
      page,

      connectedAt: Date.now(),
    };
  }

  async dispose(): Promise<void> {
    if (!this.session) return;

    await this.session.browser.close().catch(() => {});
    this.session = null;
  }
}
