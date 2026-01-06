import { Locator, Page } from "@playwright/test";
import { textEquals } from "./DropdownTextMatcher";

export class VirtualizedOptionScroller {
  static async findByScrolling(
    page: Page,
    listbox: Locator,
    optionText: string,
    caseSensitive: boolean,
    maxScrolls = 30,
    scrollStepPx = 300
  ): Promise<Locator | null> {
    let lastScrollTop = -1;

    for (let i = 0; i < maxScrolls; i++) {
      const options = listbox.locator('li[role="option"]');
      const count = await options.count();

      for (let j = 0; j < count; j++) {
        const opt = options.nth(j);
        const text = (await opt.innerText()).trim();

        if (textEquals(text, optionText, caseSensitive)) {
          return opt;
        }
      }

      const currentScrollTop = await listbox.evaluate(el => el.scrollTop);
      if (currentScrollTop === lastScrollTop) break;

      lastScrollTop = currentScrollTop;

      await listbox.evaluate(
        (el, step) => { el.scrollTop += step; },
        scrollStepPx
      );

      await page.waitForTimeout(150);
    }

    return null;
  }
}
