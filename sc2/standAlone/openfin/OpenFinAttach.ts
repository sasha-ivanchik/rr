import { chromium, Page, BrowserContext } from "playwright";

export class OpenFinAttach {
  static async attachToRuntime(
    wsEndpoint: string
  ): Promise<Page> {
    const browser = await chromium.connectOverCDP(wsEndpoint);
    const context = browser.contexts()[0];

    if (!context) {
      throw new Error("No browser context");
    }

    return this.waitForHttpPage(context);
  }

  private static async waitForHttpPage(
    context: BrowserContext
  ): Promise<Page> {
    for (const page of context.pages()) {
      if (this.isHttp(page)) {
        await page.waitForLoadState("domcontentloaded");
        return page;
      }
    }

    const page = await context.waitForEvent("page", {
      predicate: (p) => this.isHttp(p),
      timeout: 60_000,
    });

    await page.waitForLoadState("domcontentloaded");
    return page;
  }

  private static isHttp(page: Page) {
    const url = page.url();
    return url.startsWith("http://") || url.startsWith("https://");
  }
}
