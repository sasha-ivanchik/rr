import { Locator } from "@playwright/test";
import { DropdownType } from "./DropdownType";

export class DropdownClearer {
  static async clear(type: DropdownType, root: Locator) {
    switch (type) {
      case DropdownType.MUI_AUTOCOMPLETE:
        await this.clearMuiAutocomplete(root);
        break;

      case DropdownType.HTML_SELECT:
        await root.selectOption([]);
        break;

      case DropdownType.MUI_SELECT:
      default:
        break;
    }
  }

  private static async clearMuiAutocomplete(root: Locator) {
    const clearButtons = root.locator(
      'button[aria-label="Clear"], button[title="Clear"]'
    );

    const count = await clearButtons.count();
    for (let i = 0; i < count; i++) {
      await clearButtons.nth(i).click();
    }
  }
}
