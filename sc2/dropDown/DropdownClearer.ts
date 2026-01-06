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
    // hover может быть необходим, чтобы кнопки стали видимы
    try {
      await root.hover({ force: true });
    } catch {
      // ignore hover issues
    }

    // 1️⃣ Пытаемся найти Clear-кнопку
    const clearButtons = root.locator(
      'button[aria-label="Clear"], button[title="Clear"]'
    );

    if (await clearButtons.count()) {
      for (let i = 0; i < await clearButtons.count(); i++) {
        const btn = clearButtons.nth(i);
        if (await btn.isVisible()) {
          await btn.click({ force: true });
          return;
        }
      }
    }

    // 2️⃣ Если нет Clear — удаляем chips
    const chipDeleteIcons = root.locator(
      '[class*="MuiChip-deleteIcon"]'
    );

    const chipCount = await chipDeleteIcons.count();

    if (!chipCount) {
      // очищать нечего
      return;
    }

    for (let i = 0; i < chipCount; i++) {
      const icon = chipDeleteIcons.nth(i);

      try {
        if (!(await icon.isVisible())) {
          await icon.hover({ force: true });
        }
        await icon.click({ force: true });
      } catch {
        // если один чип не удалился — продолжаем
      }
    }
  }
}
