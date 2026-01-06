import { Locator, Page } from "@playwright/test";

/**
 * Find option with exact text inside a popup, supporting virtualized lists:
 *  - check for option
 *  - scroll container
 *  - check again
 * until end or found
 */
export async function findOptionWithVirtualScroll(
  page: Page,
  popup: Locator,
  optionText: string,
  caseSensitive: boolean
): Promise<Locator | null> {
  // We search within popup for common option nodes.
  // For MUI:
  // - role="option"
  // - li.MuiMenuItem-root
  // - li[role="option"] or [role="menuitem"]
  const exact = buildExactTextRegex(optionText, caseSensitive);

  const optionLocator = () =>
    popup
      .locator(`[role="option"], [role="menuitem"], li`)
      .filter({ hasText: exact });

  // 1) quick check
  if (await optionLocator().count()) {
    return optionLocator().first();
  }

  // 2) identify scroll container
  // Most reliable: listbox/menu itself, or its first scrollable descendant.
  const scrollCandidate = popup.locator(
    `[role="listbox"], [role="menu"], .MuiList-root, .MuiMenu-list`
  );

  let scroller: Locator = scrollCandidate.first();
  if ((await scrollCandidate.count()) === 0) {
    // fallback: popup itself
    scroller = popup;
  }

  // scroll loop
  let lastScrollTop = -1;

  for (let step = 0; step < 80; step++) {
    // check before each scroll
    const cnt = await optionLocator().count();
    if (cnt > 0) return optionLocator().first();

    // attempt to scroll down
    const cur = await getScrollTop(page, scroller);
    if (cur === lastScrollTop) {
      // no progress => try alternate scroller inside
      const inner = popup.locator("*").filter({
        has: popup.locator(":scope"),
      });
      // ignore; we just break if no progress
    }
    lastScrollTop = cur;

    const progressed = await scrollBy(page, scroller, 250);
    // let virtualized list render
    await page.waitForTimeout(50);

    if (!progressed) break;
  }

  // final check
  if (await optionLocator().count()) return optionLocator().first();
  return null;
}

function buildExactTextRegex(text: string, caseSensitive: boolean): RegExp {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^\\s*${escaped}\\s*$`, caseSensitive ? "" : "i");
}

async function getScrollTop(page: Page, el: Locator): Promise<number> {
  try {
    return await el.evaluate((node: any) => {
      const e = node as HTMLElement;
      return (e as any).scrollTop ?? 0;
    });
  } catch {
    return 0;
  }
}

async function scrollBy(page: Page, el: Locator, delta: number): Promise<boolean> {
  try {
    const before = await getScrollTop(page, el);
    const after = await el.evaluate((node: any, d: number) => {
      const e = node as HTMLElement;
      const prev = (e as any).scrollTop ?? 0;
      (e as any).scrollTop = prev + d;
      return (e as any).scrollTop ?? prev;
    }, delta);

    // If scrollTop didn't move, maybe container isn't scrollable -> try wheel
    if (after === before) {
      try {
        await el.hover({ timeout: 500 });
        await page.mouse.wheel(0, delta);
        await page.waitForTimeout(30);
      } catch {}
      const afterWheel = await getScrollTop(page, el);
      return afterWheel !== before;
    }

    return after !== before;
  } catch {
    // wheel fallback
    try {
      await el.hover({ timeout: 500 });
      await page.mouse.wheel(0, delta);
      await page.waitForTimeout(30);
      return true;
    } catch {
      return false;
    }
  }
}
