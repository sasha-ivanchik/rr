import { Locator } from "@playwright/test";
import { textEquals } from "./DropdownTextMatcher";

export class DropdownOptionFinder {
  static async findVisibleOption(
    listbox: Locator,
    optionText: string,
    caseSensitive: boolean
  ): Promise<Locator | null> {
    const options = listbox.locator('li[role="option"]');
    const count = await options.count();

    for (let i = 0; i < count; i++) {
      const opt = options.nth(i);
      const text = (await opt.innerText()).trim();

      if (textEquals(text, optionText, caseSensitive)) {
        return opt;
      }
    }

    return null;
  }
}
