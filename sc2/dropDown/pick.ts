import { Page, Locator } from "@playwright/test";
import { DropdownDetection } from "./types";
import { findOptionWithVirtualScroll } from "./virtualScroll";

/**
 * Entry point
 */
export async function pickValues(
  page: Page,
  det: DropdownDetection,
  values: string[],
  opts: { caseSensitive: boolean; strict: boolean }
): Promise<boolean> {
  const value = values[0];
  if (!value) return false;

  switch (det.kind) {
    case "html-select":
      return pickHtmlSelect(det, value);

    case "mui-autocomplete":
      return pickMuiAutocomplete(page, det, value, opts.caseSensitive);

    case "mui-select":
      return pickMuiSelectWithScroll(page, det, value, opts.caseSensitive);

    default:
      return false;
  }
}

/* =================================================================== */
/* =========================== HTML SELECT ============================ */
/* =================================================================== */

async function pickHtmlSelect(
  det: DropdownDetection,
  value: string
): Promise<boolean> {
  if (!det.nativeSelect) return false;

  try {
    await det.nativeSelect.selectOption({ label: value });
    return true;
  } catch {
    return false;
  }
}

/* =================================================================== */
/* ============================ MUI SELECT ============================= */
/* =================================================================== */

async function pickMuiSelectWithScroll(
  page: Page,
  det: DropdownDetection,
  value: string,
  caseSensitive: boolean
): Promise<boolean> {
  await openDropdown(page, det);

  const popup = await getActivePopup(page);

  // MUI Select: сразу работаем со скроллом
  const option = await findOptionWithVirtualScroll(
    page,
    popup,
    value,
    caseSensitive
  );

  if (!option) {
    await safeClose(page);
    return false;
  }

  await option.click();
  await safeClose(page);
  return true;
}

/* =================================================================== */
/* ======================== MUI AUTOCOMPLETE ========================== */
/* =================================================================== */

async function pickMuiAutocomplete(
  page: Page,
  det: DropdownDetection,
  value: string,
  caseSensitive: boolean
): Promise<boolean> {
  if (!det.input) return false;

  // 1️⃣ open dropdown (focus input!)
  await openAutocomplete(page, det);

  const popup = await getActivePopup(page);

  // 2️⃣ check visible options (NO SCROLL)
  let option = await findVisibleOption(
    popup,
    value,
    caseSensitive
  );

  // 3️⃣ if not found — type to filter
  if (!option) {
    await filterByTyping(det.input, value);
    await page.waitForTimeout(150);

    option = await findVisibleOption(
      popup,
      value,
      caseSensitive
    );
  }

  // 4️⃣ if still not found — virtual scroll
  if (!option) {
    option = await findOptionWithVirtualScroll(
      page,
      popup,
      value,
      caseSensitive
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

/* =================================================================== */
/* ============================== HELPERS ============================= */
/* =================================================================== */

async function openDropdown(page: Page, det: DropdownDetection) {
  try {
    await det.root.hover();
  } catch {}

  await det.trigger.click({ timeout: 3000 });
  await page.waitForTimeout(50);
}

async function openAutocomplete(page: Page, det: DropdownDetection) {
  try {
    await det.root.hover();
  } catch {}

  // ⚠️ Autocomplete: кликаем ТОЛЬКО input
  await det.input!.click({ timeout: 3000 });
  await page.waitForTimeout(50);
}

async function getActivePopup(page: Page): Promise<Locator> {
  const popup = page.locator(".MuiPopover-root").last();
  await popup.waitFor({ state: "visible", timeout: 3000 });
  return popup;
}

/**
 * Find already rendered options.
 * NO SCROLL.
 */
async function findVisibleOption(
  popup: Locator,
  value: string,
  caseSensitive: boolean
): Promise<Locator | null> {
  const rx = buildExactTextRegex(value, caseSensitive);

  const option = popup
    .locator('[role="option"], [role="menuitem"], li')
    .filter({ hasText: rx });

  if (await option.count()) {
    return option.first();
  }

  return null;
}

/**
 * Clears input and types full value.
 */
async function filterByTyping(
  input: Locator,
  value: string
) {
  await input.fill("");
  await input.type(value, { delay: 40 });
}

function buildExactTextRegex(
  text: string,
  caseSensitive: boolean
): RegExp {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^\\s*${escaped}\\s*$`, caseSensitive ? "" : "i");
}

async function safeClose(page: Page) {
  try {
    await page.keyboard.press("Escape");
  } catch {}
  await page.waitForTimeout(50);
}


// ===============================================================================
import { Page, Locator, expect } from "@playwright/test";

/**
 * MUI Select / Menu / Popover
 */
export async function getActivePopupForSelect(page: Page): Promise<Locator> {
  // MUI Select всегда рендерится как menu/listbox
  const popup = page
    .locator('[role="listbox"], [role="menu"]')
    .filter({ hasNot: page.locator('[aria-hidden="true"]') })
    .last();

  await expect(popup).toBeVisible({ timeout: 3000 });
  return popup;
}

/**
 * MUI Autocomplete (Popper)
 */
export async function getActivePopupForAutocomplete(page: Page): Promise<Locator> {
  // Autocomplete options всегда role="listbox"
  const popup = page
    .locator('[role="listbox"]')
    .filter({ hasNot: page.locator('[aria-hidden="true"]') })
    .last();

  await expect(popup).toBeVisible({ timeout: 3000 });
  return popup;
}

/**
 * Dispatcher — единая точка входа
 */
export async function getActivePopup(
  page: Page,
  kind: "mui-select" | "mui-autocomplete"
): Promise<Locator> {
  if (kind === "mui-autocomplete") {
    return getActivePopupForAutocomplete(page);
  }

  return getActivePopupForSelect(page);
}
