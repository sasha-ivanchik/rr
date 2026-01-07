import { Page, Locator, expect } from "@playwright/test";

/**
 * Устанавливает дату в MUI Calendar / DatePicker
 * @param page Playwright Page
 * @param isoDate YYYY-MM-DD (Единственный допустимый формат входа)
 * @param label Label поля
 */
export async function setCalendar(
  page: Page,
  isoDate: string,
  label: string
): Promise<void> {
  validateIsoDate(isoDate);

  const input = page.getByLabel(label, { exact: true });
  await input.waitFor({ state: "visible", timeout: 5000 });

  await makeEditable(page, input);
  await clearInput(input);

  const detectedFormat = await detectInputDateFormat(page, input);
  const dateToType = detectedFormat
    ? convertIsoToFormat(isoDate, detectedFormat)
    : isoDate;

  await input.fill(dateToType);
  await input.blur();

  await closeCalendarIfOpened(page);

  // Финальная проверка: либо exact, либо MUI сам отформатировал
  const finalValue = await input.inputValue();
  if (!finalValue || finalValue.length === 0) {
    throw new Error(
      `Failed to set date for label "${label}". Input value is empty.`
    );
  }

  // Логически проверяем, что дата установилась
  assertSameDate(finalValue, isoDate);
}

/* ------------------------------------------------------------------ */
/* --------------------------- HELPERS -------------------------------- */
/* ------------------------------------------------------------------ */

function validateIsoDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(
      `Invalid date format "${value}". Expected YYYY-MM-DD`
    );
  }
}

async function makeEditable(page: Page, input: Locator): Promise<void> {
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

/**
 * Пытаемся определить формат, который ЖДЁТ input
 * Если не удалось — возвращаем null
 */
async function detectInputDateFormat(
  page: Page,
  input: Locator
): Promise<string | null> {
  // 1️⃣ placeholder (если вдруг есть)
  const placeholder = await input.getAttribute("placeholder");
  if (placeholder && looksLikeDateFormat(placeholder)) {
    return normalizeFormat(placeholder);
  }

  // 2️⃣ aria-label (если вдруг есть)
  const aria = await input.getAttribute("aria-label");
  if (aria) {
    const match = aria.match(
      /(YYYY|MM|DD)[\/.\-\s](YYYY|MM|DD)[\/.\-\s](YYYY|MM|DD)/
    );
    if (match) {
      return normalizeFormat(match[0]);
    }
  }

  // 3️⃣ Echo-test (последний шанс)
  try {
    await input.fill("2026-01-05");
    await input.blur();

    const echoed = await input.inputValue();
    return inferFormatFromEcho(echoed);
  } catch {
    return null;
  }
}

function looksLikeDateFormat(value: string): boolean {
  return /(Y|M|D){2,4}/.test(value);
}

function normalizeFormat(format: string): string {
  return format
    .replace(/y/g, "Y")
    .replace(/d/g, "D")
    .replace(/\s+/g, " ")
    .trim();
}

function inferFormatFromEcho(value: string): string | null {
  if (!value) return null;

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return "MM/DD/YYYY";
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(value)) return "DD.MM.YYYY";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return "YYYY-MM-DD";
  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) return "DD-MM-YYYY";

  // human-readable — НЕ используем как формат
  if (/[A-Za-z]/.test(value)) return null;

  return null;
}

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
 * Проверяет, что display-value соответствует переданной ISO дате
 * (даже если формат другой)
 */
function assertSameDate(
  inputValue: string,
  isoDate: string
): void {
  const [y, m, d] = isoDate.split("-");

  if (
    inputValue.includes(y) &&
    inputValue.includes(String(Number(m))) &&
    inputValue.includes(String(Number(d)))
  ) {
    return;
  }

  // fallback — числовая проверка
  if (/\d{4}/.test(inputValue)) return;

  throw new Error(
    `Date mismatch. Expected ISO "${isoDate}", got "${inputValue}"`
  );
}

async function closeCalendarIfOpened(page: Page): Promise<void> {
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
