import { Locator, Page } from "@playwright/test";
import { DropdownType } from "./DropdownType";
import { DropdownOptionFinder } from "./DropdownOptionFinder";
import { VirtualizedOptionScroller } from "./VirtualizedOptionScroller";
import {
  DEFAULT_DROPDOWN_OPTIONS,
  DropdownSelectOptions,
} from "./DropdownOptions";
import { DropdownSelectionResult } from "./DropdownResult";

export class DropdownActions {
  static async select(
    page: Page,
    type: DropdownType,
    root: Locator,
    values: string[],
    options?: DropdownSelectOptions
  ): Promise<DropdownSelectionResult> {
    switch (type) {
      case DropdownType.MUI_AUTOCOMPLETE:
        return this.selectMuiAutocomplete(page, root, values, options);

      case DropdownType.MUI_SELECT:
        return this.selectMuiSelect(page, root, values[0], options);

      case DropdownType.HTML_SELECT:
        await root.selectOption(values);
        return Object.fromEntries(values.map(v => [v, true]));
    }
  }

  private static async selectMuiAutocomplete(
    page: Page,
    root: Locator,
    values: string[],
    options?: DropdownSelectOptions
  ): Promise<DropdownSelectionResult> {
    const opts = { ...DEFAULT_DROPDOWN_OPTIONS, ...options };
    const input = root.locator("input");
    await input.click();

    const listbox = page.locator('ul[role="listbox"]').first();
    const result: Record<string, boolean> = {};

    for (const value of values) {
      let selected = false;

      for (let attempt = 1; attempt <= opts.retries; attempt++) {
        let option =
          (await DropdownOptionFinder.findVisibleOption(
            listbox,
            value,
            opts.caseSensitive
          )) ??
          (await VirtualizedOptionScroller.findByScrolling(
            page,
            listbox,
            value,
            opts.caseSensitive
          ));

        if (!option) {
          await input.fill("");
          await input.fill(value);
          await page.waitForTimeout(opts.retryTimeoutMs);

          option =
            (await DropdownOptionFinder.findVisibleOption(
              listbox,
              value,
              opts.caseSensitive
            )) ??
            (await VirtualizedOptionScroller.findByScrolling(
              page,
              listbox,
              value,
              opts.caseSensitive
            ));
        }

        if (option) {
          await option.click();
          selected = true;
          break;
        }
      }

      result[value] = selected;
    }

    return Object.values(result).every(v => !v) ? false : result;
  }

  private static async selectMuiSelect(
    page: Page,
    root: Locator,
    value: string,
    options?: DropdownSelectOptions
  ): Promise<DropdownSelectionResult> {
    const opts = { ...DEFAULT_DROPDOWN_OPTIONS, ...options };
    await root.click();

    const listbox = page.locator('ul[role="listbox"]').first();
    let option: Locator | null = null;

    for (let attempt = 1; attempt <= opts.retries; attempt++) {
      option =
        (await DropdownOptionFinder.findVisibleOption(
          listbox,
          value,
          opts.caseSensitive
        )) ??
        (await VirtualizedOptionScroller.findByScrolling(
          page,
          listbox,
          value,
          opts.caseSensitive
        ));

      if (option) break;
      await page.waitForTimeout(opts.retryTimeoutMs);
    }

    if (option) {
      await option.click();
      return { [value]: true };
    }

    return false;
  }
}
