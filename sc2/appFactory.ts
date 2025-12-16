import { Page, BrowserContext } from "playwright";

export async function attachToChildApp(
  parentPage: Page,
  options?: {
    timeoutMs?: number;
    pollMs?: number;
    isChild?: (page: Page) => Promise<boolean> | boolean;
  }
): Promise<Page> {
  const timeoutMs = options?.timeoutMs ?? 120_000;
  const pollMs = options?.pollMs ?? 1_000;
  const start = Date.now();

  const context = parentPage.context();

  const isChildPage = async (page: Page) => {
    const url = page.url();

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return false;
    }

    if (page === parentPage) {
      return false;
    }

    if (options?.isChild) {
      return await options.isChild(page);
    }

    return true;
  };

  console.log("[attachToChildApp] waiting for child app...");

  while (Date.now() - start < timeoutMs) {
    // 1️⃣ проверяем существующие страницы
    for (const page of context.pages()) {
      if (await isChildPage(page)) {
        console.log("[attachToChildApp] child page found (existing):", page.url());
        await page.waitForLoadState("domcontentloaded");
        await page.bringToFront();
        return page;
      }
    }

    // 2️⃣ ждём новую страницу
    try {
      const page = await context.waitForEvent("page", {
        timeout: pollMs,
      });

      if (await isChildPage(page)) {
        console.log("[attachToChildApp] child page found (new):", page.url());
        await page.waitForLoadState("domcontentloaded");
        await page.bringToFront();
        return page;
      }
    } catch {
      // норм — просто не появилось за pollMs
    }
  }

  throw new Error("attachToChildApp timeout: child app not found");
}
