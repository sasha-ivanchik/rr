import { Page, BrowserContext } from "playwright";

export async function findHttpPage(
  context: BrowserContext
): Promise<Page> {
  // сначала пробуем уже существующие
  for (const page of context.pages()) {
    const url = page.url();
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return page;
    }
  }

  // если ещё не появилась — ждём
  return await context.waitForEvent("page", {
    predicate: (page) => {
      const url = page.url();
      return (
        url.startsWith("http://") ||
        url.startsWith("https://")
      );
    },
    timeout: 15_000,
  });
}
