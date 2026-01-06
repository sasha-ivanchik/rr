import { Page, Locator } from "@playwright/test";
import { DropdownType } from "./DropdownType";

export class DropdownDetector {
  static async detect(
    page: Page,
    label: string
  ): Promise<{ type: DropdownType; root: Locator }> {
    const labelEl = page.locator(`label:has-text("${label}")`);

    const muiAutocomplete = labelEl
      .locator("xpath=following::div[contains(@class,'MuiAutocomplete-root')]")
      .first();

    if (await muiAutocomplete.count()) {
      return { type: DropdownType.MUI_AUTOCOMPLETE, root: muiAutocomplete };
    }

    const muiSelect = labelEl
      .locator("xpath=following::div[contains(@class,'MuiSelect-root')]")
      .first();

    if (await muiSelect.count()) {
      return { type: DropdownType.MUI_SELECT, root: muiSelect };
    }

    const htmlSelect = labelEl
      .locator("xpath=following::select")
      .first();

    if (await htmlSelect.count()) {
      return { type: DropdownType.HTML_SELECT, root: htmlSelect };
    }

    throw new Error(`Dropdown with label "${label}" not found`);
  }
}
