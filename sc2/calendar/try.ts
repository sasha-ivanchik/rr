import { Page, Locator } from "@playwright/test";

/**
 * Tries to set date in MUI DatePicker by probing common formats.
 * Logs each attempt and stops on the first accepted format.
 *
 * @param page Playwright Page
 * @param isoDate Date in ISO format (YYYY-MM-DD)
 * @param label Label text
 * @returns true if date was accepted by UI, false otherwise
 */
export async function setCalendar(
  page: Page,
  isoDate: string,
  label: string
): Promise<boolean> {
  if (!isValidIsoDate(isoDate)) {
    console.warn(`[Calendar] Invalid ISO date provided: ${isoDate}`);
    return false;
  }

  let input: Locator;
  try {
    input = await findInputByLabelProximity(page, label);
  } catch (e) {
    console.warn(`[Calendar] Input not found for label "${label}"`);
    return false;
  }

  await makeEditable(page, input);

  const candidates = buildCandidateFormats(isoDate);

  for (const candidate of candidates) {
    console.log(`[Calendar] Trying format: "${candidate}"`);

    await clearInput(input);
    await input.fill(candidate);
    await input.blur();

    await closeCalendarIfOpened(page);

    const accepted = await isDateAccepted(input);

    if (accepted) {
      console.log(`[Calendar] Accepted format: "${candidate}"`);
      return true;
    } else {
      console.log(`[Calendar] Rejected format: "${candidate}"`);
    }
  }

  console.warn(
    `[Calendar] No supported date format found for label "${label}"`
  );
  return false;
}

/* ------------------------------------------------------------------ */
/* ----------------------------- HELPERS ------------------------------ */
/* ------------------------------------------------------------------ */

function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Generates most common date formats used in MUI / browsers
 */
function buildCandidateFormats(iso: string): string[] {
  const [y, m, d] = iso.split("-");

  return [
    // ISO
    `${y}-${m}-${d}`,

    // US
    `${m}/${d}/${y}`,
    `${m}-${d}-${y}`,

    // EU
    `${d}/${m}/${y}`,
    `${d}.${m}.${y}`,
    `${d}-${m}-${y}`,

    // Compact
    `${y}/${m}/${d}`,

    // No leading zeros (some inputs expect this)
    `${Number(m)}/${Number(d)}/${y}`,
    `${Number(d)}/${Number(m)}/${y}`,
  ];
}

/**
 * Checks if UI accepted the entered date
 * We assume rejection if value is empty or unchanged after blur
 */
async function isDateAccepted(input: Locator): Promise<boolean> {
  const value = await input.inputValue();

  if (!value) return false;

  // MUI often clears invalid values
  if (/invalid/i.test(value)) return false;

  return true;
}

async function makeEditable(
  page: Page,
  input: Locator
): Promise<void> {
  const handle = await input.elementHandle();
  if (!handle) return;

  await page.evaluate((el: HTMLInputElement) => {
    el.removeAttribute("readonly");
    el.removeAttribute("disabled");
  }, handle);
}

async function clearInput(input: Locator): Promise<void> {
  await input.click();
  await input.press("Meta+A").catch(() => {});
  await input.press("Control+A").catch(() => {});
  await input.press("Backspace");
}

async function closeCalendarIfOpened(page: Page): Promise<void> {
  const popup = page.locator(
    ".MuiPickersPopper-root, .MuiPopover-root"
  );

  const visible = await popup
    .isVisible({ timeout: 200 })
    .catch(() => false);

  if (visible) {
    await page.keyboard.press("Escape");
  }
}

/**
 * DOM-proximity based input lookup (label → neighbors → parents)
 */
async function findInputByLabelProximity(
  page: Page,
  labelText: string,
  maxDepth: number = 6
): Promise<Locator> {
  const label = page.locator(`text="${labelText}"`).first();
  await label.waitFor({ state: "visible", timeout: 5000 });

  let current: Locator = label;

  for (let depth = 0; depth < maxDepth; depth++) {
    const input = current.locator(
      "input:not([type='hidden'])"
    );
    if (await input.count()) {
      return input.first();
    }

    const siblingInput = current.locator(
      "xpath=following-sibling::*//input"
    );
    if (await siblingInput.count()) {
      return siblingInput.first();
    }

    current = current.locator("xpath=..");
  }

  throw new Error("Input not found by proximity search");
}
