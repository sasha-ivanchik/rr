import { Locator, Page } from "@playwright/test";
import { PopupDropdownKind } from "./types";

/**
 * Safely closes ONLY the dropdown popup,
 * without closing parent Dialog / Modal.
 *
 * If popup is already closed or invisible — NOOP.
 */
export async function closeDropdownSafely(
  page: Page,
  popup: Locator,
  kind: PopupDropdownKind
): Promise<void> {
  // 🛑 GUARD 1: popup detached or not found
  if (!(await popupExists(popup))) {
    return;
  }

  // 🛑 GUARD 2: popup already hidden
  if (!(await popupIsVisible(popup))) {
    return;
  }

  // 1️⃣ Try click outside popup but inside context root
  const contextRoot = await resolveContextRoot(page);

  if (contextRoot) {
    try {
      const box = await contextRoot.boundingBox();
      if (box) {
        await page.mouse.click(box.x + 5, box.y + 5);
        await popup.waitFor({ state: "hidden", timeout: 1000 });
        return;
      }
    } catch {
      // continue to next strategy
    }
  }

  // 2️⃣ Blur active element (works well for Autocomplete)
  try {
    await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      el?.blur();
    });

    // popup may already be gone — don't force wait
    if (await popupExists(popup)) {
      await popup.waitFor({ state: "hidden", timeout: 1000 });
    }
    return;
  } catch {
    // continue
  }

  // 3️⃣ ESC — LAST RESORT (may close Dialog, so guarded)
  try {
    await page.keyboard.press("Escape");

    if (await popupExists(popup)) {
      await popup.waitFor({ state: "hidden", timeout: 1000 });
    }
  } catch {
    // give up silently
  }
}

/* ------------------------------------------------------------------ */
/* ----------------------------- HELPERS ------------------------------ */
/* ------------------------------------------------------------------ */

async function popupExists(popup: Locator): Promise<boolean> {
  try {
    return (await popup.count()) > 0;
  } catch {
    return false;
  }
}

async function popupIsVisible(popup: Locator): Promise<boolean> {
  try {
    return await popup.isVisible();
  } catch {
    return false;
  }
}

/**
 * Finds a safe context root where we can click
 * without closing parent dialog.
 */
async function resolveContextRoot(page: Page): Promise<Locator | null> {
  // Prefer visible Dialog
  const dialog = page.locator('[role="dialog"]:visible').last();
  if (await dialog.count()) return dialog;

  // MUI Drawer / Modal
  const drawer = page.locator('[role="presentation"]:visible').last();
  if (await drawer.count()) return drawer;

  // fallback: body
  return page.locator("body");
}
