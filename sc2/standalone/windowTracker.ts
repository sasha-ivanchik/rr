import { BrowserContext, Page } from "@playwright/test";

export class WindowTracker {
  private basePage!: Page;

  constructor(private readonly context: BrowserContext) {}

  async captureBase(): Promise<void> {
    const pages = this.context.pages();
    if (!pages.length) {
      throw new Error("No pages to capture as base");
    }
    this.basePage = pages[0];
  }

  async cleanup(): Promise<void> {
    const pages = this.context.pages();

    for (const page of pages) {
      if (page !== this.basePage) {
        await page.close().catch(() => {});
      }
    }
  }

  getMainPage(): Page {
    return this.basePage;
  }
}
