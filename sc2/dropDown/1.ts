import { Locator, Page } from "@playwright/test";
import { PopupDropdownKind } from "./types";

/**
 * Safely closes ONLY the dropdown popup,
 * without closing parent Dialog / Modal.
 */
export async function closeDropdownSafely(
  page: Page,
  popup: Locator,
  kind: PopupDropdownKind
): Promise<void> {
  // 1️⃣ Try click outside popup but inside dialog / root
  const contextRoot = await resolveContextRoot(page, popup);

  if (contextRoot) {
    try {
      const box = await contextRoot.boundingBox();
      if (box) {
        // click a safe spot (top-left corner inside context)
        await page.mouse.click(box.x + 5, box.y + 5);
        await popup.waitFor({ state: "hidden", timeout: 1000 });
        return;
      }
    } catch {
      /* try next strategy */
    }
  }

  // 2️⃣ Blur active element (safe for Autocomplete)
  try {
    await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      el?.blur();
    });
    await popup.waitFor({ state: "hidden", timeout: 1000 });
    return;
  } catch {
    /* try next */
  }

  // 3️⃣ ESC — LAST RESORT
  try {
    await page.keyboard.press("Escape");
    await popup.waitFor({ state: "hidden", timeout: 1000 });
  } catch {
    // give up silently
  }
}

/**
 * Finds nearest dialog / modal / drawer,
 * otherwise falls back to body.
 */
async function resolveContextRoot(
  page: Page,
  popup: Locator
): Promise<Locator | null> {
  // Prefer MUI Dialog
  const dialog = page.locator(
    '[role="dialog"]:visible'
  ).last();
  if (await dialog.count()) return dialog;

  // MUI Drawer
  const drawer = page.locator(
    '[role="presentation"]:visible'
  ).last();
  if (await drawer.count()) return drawer;

  // fallback: body
  return page.locator("body");
}
