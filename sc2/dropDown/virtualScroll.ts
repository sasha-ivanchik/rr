import { Locator, Page } from "@playwright/test";
import { muiClass } from "./muiLocators";

export async function findOptionWithVirtualScroll(
  page: Page,
  popup: Locator,
  optionText: string,
  caseSensitive: boolean
): Promise<Locator | null> {
  const rx = buildExact(optionText, caseSensitive);

  const option = () =>
    popup.locator(
      '[role="option"], [role="menuitem"]'
    ).filter({ hasText: rx });

  if (await option().count()) return option().first();

  // 🟢 dynamic MUI list containers
  const scroller =
    muiClass(popup, "MuiList").first() ??
    popup;

  let lastTop = -1;

  for (let i = 0; i < 80; i++) {
    if (await option().count()) return option().first();

    const cur = await getScrollTop(scroller);
    if (cur === lastTop) break;
    lastTop = cur;

    await scrollBy(page, scroller, 250);
    await page.waitForTimeout(50);
  }

  return (await option().count()) ? option().first() : null;
}

function buildExact(text: string, cs: boolean) {
  const e = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^\\s*${e}\\s*$`, cs ? "" : "i");
}

async function getScrollTop(el: Locator): Promise<number> {
  try {
    return await el.evaluate((n: any) => n.scrollTop ?? 0);
  } catch {
    return 0;
  }
}

async function scrollBy(page: Page, el: Locator, dy: number) {
  try {
    await el.evaluate((n: any, d: number) => {
      n.scrollTop += d;
    }, dy);
  } catch {
    try {
      await el.hover();
      await page.mouse.wheel(0, dy);
    } catch {}
  }
}
