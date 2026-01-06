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

  // HTML select
  if (det.kind === "html-select" && det.nativeSelect) {
    try {
      await det.nativeSelect.selectOption({ label: value });
      return true;
    } catch {
      return false;
    }
  }

  await openDropdown(page, det);

  const popup = await getActivePopup(page);

  // 1. try visible options first (no scroll)
  let option = await findVisibleOption(popup, value, opts.caseSensitive);
  if (!option && det.kind === "mui-autocomplete" && det.input) {
    // 2. type into input to filter
    await det.input.fill("");
    await det.input.type(value, { delay: 50 });
    await page.waitForTimeout(150);

    option = await findVisibleOption(popup, value, opts.caseSensitive);
  }

  // 3. fallback to virtualized scroll
  if (!option) {
    option = await findOptionWithVirtualScroll(
      page,
      popup,
      value,
      opts.caseSensitive
    );
  }

  if (!option) {
    await safeClose(page);
    return false;
  }

  await option.click();
  await safeClose(page);
  return true;
}

async function findVisibleOption(
  popup: any,
  value: string,
  caseSensitive: boolean
) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rx = new RegExp(`^\\s*${escaped}\\s*$`, caseSensitive ? "" : "i");

  const option = popup
    .locator("[role='option'],[role='menuitem'],li")
    .filter({ hasText: rx });

  if (await option.count()) return option.first();
  return null;
}

async function openDropdown(page: Page, det: DropdownDetection) {
  try {
    await det.root.hover();
  } catch {}

  await det.trigger.click();
  await page.waitForTimeout(50);
}

async function getActivePopup(page: Page) {
  const popup = page.locator(".MuiPopover-root").last();
  await popup.waitFor({ state: "visible", timeout: 3000 });
  return popup;
}

async function safeClose(page: Page) {
  try {
    await page.keyboard.press("Escape");
  } catch {}
  await page.waitForTimeout(50);
}
