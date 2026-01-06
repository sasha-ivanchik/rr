import { Page } from "@playwright/test";
import { DropdownDetection } from "./types";

/**
 * Try to click clear buttons and delete chips.
 * Requirements:
 *  - aria-label="Clear" OR title="Clear"
 *  - MuiChip-deleteIcon (may appear only on hover)
 *  - if nothing to clear => do nothing
 */
export async function clearDropdown(page: Page, det: DropdownDetection): Promise<void> {
  const root = det.root;

  // Hover root first to reveal hover-only icons
  try {
    await root.hover({ trial: true });
    await root.hover();
  } catch {
    // ignore hover errors
  }

  // 1) clear buttons
  const clearBtn = root
    .locator(`[aria-label="Clear"], [title="Clear"]`)
    // keep strict ownership: only visible/clickable candidates inside root
    .filter({ hasNot: page.locator("[aria-hidden='true']") });

  const clearCount = await clearBtn.count();
  if (clearCount > 0) {
    // click all visible clear buttons in root (usually 1)
    for (let i = 0; i < clearCount; i++) {
      const btn = clearBtn.nth(i);
      try {
        await btn.hover({ trial: true });
        await btn.hover();
      } catch {}
      // use force=false; if not clickable it will throw and we continue
      try {
        await btn.click({ timeout: 1000 });
      } catch {
        // ignore, we will still try chip delete icons
      }
    }
  }

  // 2) delete chips icons (Autocomplete multi-select etc.)
  // These icons may only appear on hover of chip or root.
  const deleteIcons = root.locator(".MuiChip-deleteIcon");
  const n = await deleteIcons.count();

  if (n > 0) {
    // click until none left (DOM changes)
    // we re-query each loop
    for (let guard = 0; guard < 50; guard++) {
      const icons = root.locator(".MuiChip-deleteIcon");
      const cnt = await icons.count();
      if (cnt === 0) break;

      const icon = icons.first();

      // ensure it becomes visible (hover root + parent chip)
      try {
        await root.hover();
      } catch {}

      try {
        const chip = icon.locator("xpath=ancestor::*[contains(@class,'MuiChip-root')][1]");
        if (await chip.count()) {
          await chip.first().hover({ timeout: 1000 });
        }
      } catch {}

      try {
        await icon.click({ timeout: 1000 });
      } catch {
        // if cannot click, break to avoid infinite loop
        break;
      }
    }
  }

  // 3) Optional: press Escape to close any opened popup (safe)
  try {
    await page.keyboard.press("Escape");
  } catch {
    // ignore
  }
}
