import { Page } from "@playwright/test";
import { DropdownDetection } from "./types";
import { muiClass, muiClickableAncestor } from "./muiLocators";

export async function clearDropdown(page: Page, det: DropdownDetection): Promise<void> {
  const root = det.root;

  // hover to reveal icons
  try {
    await root.hover();
  } catch {}

  // 1️⃣ Clear buttons
  const clearBtns = root.locator(
    `[aria-label="Clear"], [title="Clear"]`
  );

  for (let i = 0; i < await clearBtns.count(); i++) {
    try {
      await clearBtns.first().click({ timeout: 1000 });
    } catch {}
  }

  // 2️⃣ MUI Chips delete icons (dynamic class!)
  const deleteIcons = muiClass(root, "MuiChip-deleteIcon");

  for (let guard = 0; guard < 50; guard++) {
    if (await deleteIcons.count() === 0) break;

    const icon = deleteIcons.first();

    try {
      await icon.hover({ timeout: 1000 });
    } catch {}

    const clickable = muiClickableAncestor(icon);

    try {
      await clickable.click({ timeout: 1000 });
    } catch {
      break;
    }
  }

  // close popup if any
  try {
    await page.keyboard.press("Escape");
  } catch {}
}
