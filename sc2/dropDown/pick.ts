import { Page } from "@playwright/test";
import { DropdownDetection } from "./types";
import { findOptionWithVirtualScroll } from "./virtualScroll";

export async function pickValues(
  page: Page,
  det: DropdownDetection,
  values: string[],
  opts: { caseSensitive: boolean; strict: boolean }
): Promise<boolean> {
  const value = values[0];
  if (!value) return false;

  if (det.kind === "html-select" && det.nativeSelect) {
    try {
      await det.nativeSelect.selectOption({ label: value });
      return true;
    } catch {
      return false;
    }
  }

  await det.trigger.click();
  await page.waitForTimeout(50);

  const popup = page.locator(".MuiPopover-root").last();
  await popup.waitFor({ state: "visible", timeout: 3000 });

  let option = popup
    .locator('[role="option"], [role="menuitem"]')
    .filter({ hasText: buildExact(value, opts.caseSensitive) })
    .first();

  if (!(await option.count())) {
    option = await findOptionWithVirtualScroll(
      page,
      popup,
      value,
      opts.caseSensitive
    );
  }

  if (!option) {
    await page.keyboard.press("Escape");
    return false;
  }

  await option.click();
  await page.keyboard.press("Escape");
  return true;
}

function buildExact(text: string, cs: boolean) {
  const e = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^\\s*${e}\\s*$`, cs ? "" : "i");
}
