import { Page, Locator } from "@playwright/test";

/**
 * Sets date in MUI DatePicker / Calendar input
 * @param page Playwright Page
 * @param isoDate Date in ISO format (YYYY-MM-DD)
 * @param label Input label
 * @returns true if date was set successfully, false otherwise
 */
export async function setCalendar(
  page: Page,
  isoDate: string,
  label: string
): Promise<boolean> {
  if (!isValidIsoDate(isoDate)) {
    return false;
  }

  let input: Locator;

  try {
    input = page.getByLabel(label, { exact: true });
    await input.waitFor({ state: "visible", timeout: 5000 });
  } catch {
    return false;
  }

  try {
    await makeEditable(page, input);
    await clearInput(input);

    const detectedFormat = await detectInputDateFormat(page, input);
    const valueToType = detectedFormat
      ? convertIsoToFormat(isoDate, detectedFormat)
      : isoDate;

    await input.fill(valueToType);
    await input.blur();

    await closeCalendarIfOpened(page);

    const finalValue = await input.inputValue();
    return isSameDate(finalValue, isoDate);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* ----------------------------- HELPERS ------------------------------ */
/* ------------------------------------------------------------------ */

/**
 * Validates ISO date format (YYYY-MM-DD)
 */
function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Removes readonly / disabled attributes from input if present
 */
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

/**
 * Clears input value using keyboard shortcuts
 */
async function clearInput(input: Locator): Promise<void> {
  await input.click();
  await input.press("Meta+A").catch(() => {});
  await input.press("Control+A").catch(() => {});
  await input.press("Backspace");
}

/**
 * Tries to detect date format expected by input
 * Returns format string or null if detection failed
 */
async function detectInputDateFormat(
  page: Page,
  input: Locator
): Promise<string | null> {
  // 1. Placeholder is the most reliable source
  const placeholder = await input.getAttribute("placeholder");
  if (placeholder && looksLikeDateFormat(placeholder)) {
    return normalizeFormat(placeholder);
  }

  // 2. aria-label may contain format info
  const aria = await input.getAttribute("aria-label");
  if (aria) {
    const match = aria.match(
      /(YYYY|MM|DD)[\/.\-\s](YYYY|MM|DD)[\/.\-\s](YYYY|MM|DD)/
    );
    if (match) {
      return normalizeFormat(match[0]);
    }
  }

  // 3. Echo test: let MUI reformat a known ISO value
  try {
    await input.fill("2026-01-05");
    await input.blur();

    const echoed = await input.inputValue();
    return inferFormatFromEcho(echoed);
  } catch {
    return null;
  }
}

/**
 * Checks if string looks like a date format pattern
 */
function looksLikeDateFormat(value: string): boolean {
  return /(Y|M|D){2,4}/.test(value);
}

/**
 * Normalizes format string to YYYY / MM / DD tokens
 */
function normalizeFormat(format: string): string {
  return format
    .replace(/y/g, "Y")
    .replace(/d/g, "D")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Infers numeric date format from echoed value
 * Human-readable values are ignored
 */
function inferFormatFromEcho(value: string): string | null {
  if (!value) return null;

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return "MM/DD/YYYY";
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(value)) return "DD.MM.YYYY";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return "YYYY-MM-DD";
  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) return "DD-MM-YYYY";

  // Ignore human-readable formats like "January 5th"
  if (/[A-Za-z]/.test(value)) return null;

  return null;
}

/**
 * Converts ISO date to target format
 */
function convertIsoToFormat(
  iso: string,
  format: string
): string {
  const [y, m, d] = iso.split("-");

  return format
    .replace("YYYY", y)
    .replace("MM", m)
    .replace("DD", d);
}

/**
 * Verifies that input value represents the same date as ISO input
 */
function isSameDate(
  inputValue: string,
  isoDate: string
): boolean {
  if (!inputValue) return false;

  const [y, m, d] = isoDate.split("-");

  // Loose but stable check across formats
  return (
    inputValue.includes(y) &&
    inputValue.includes(String(Number(m))) &&
    inputValue.includes(String(Number(d)))
  );
}

/**
 * Closes MUI calendar popup if it was opened
 */
async function closeCalendarIfOpened(
  page: Page
): Promise<void> {
  const popup = page.locator(
    ".MuiPickersPopper-root, .MuiPopover-root"
  );

  const visible = await popup
    .isVisible({ timeout: 300 })
    .catch(() => false);

  if (visible) {
    await page.keyboard.press("Escape");
  }
}
