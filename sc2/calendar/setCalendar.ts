import { Page, Locator } from "@playwright/test";

/**
 * Sets date in MUI DatePicker using calendar clicks only.
 * Debug version with extensive logging.
 */
export async function setCalendarByClicks(
  page: Page,
  isoDate: string,
  label: string
): Promise<boolean> {
  log(`START setCalendarByClicks`);
  log(`Input label: "${label}"`);
  log(`ISO date: "${isoDate}"`);

  if (!isValidIsoDate(isoDate)) {
    warn(`Invalid ISO date`);
    return false;
  }

  const { year, monthIndex, day } = parseIso(isoDate);
  log(`Parsed date → year=${year}, monthIndex=${monthIndex}, day=${day}`);

  let input: Locator;
  try {
    input = await findInputByLabelProximity(page, label);
    log(`Input found`);
  } catch (e) {
    warn(`Input NOT found by label proximity`);
    return false;
  }

  // 1. Open picker
  log(`Opening calendar picker`);
  await openPicker(page, input);

  const picker = page
    .locator(".MuiPickersPopper-root, .MuiPopover-root")
    .last();

  try {
    await picker.waitFor({ state: "visible", timeout: 3000 });
    log(`Picker is visible`);
  } catch {
    warn(`Picker did NOT appear`);
    return false;
  }

  // 2. Switch to year view
  log(`Switching to year selection view`);
  await switchToYearView(picker);

  // 3. Select year
  log(`Selecting year: ${year}`);
  const yearSelected = await selectYear(picker, year);
  if (!yearSelected) {
    warn(`Year ${year} NOT found`);
    return false;
  }

  // 4. Select month
  log(`Selecting month index: ${monthIndex}`);
  const monthSelected = await selectMonth(picker, monthIndex);
  if (!monthSelected) {
    warn(`Month index ${monthIndex} NOT selectable`);
    return false;
  }

  // 5. Select day
  log(`Selecting day: ${day}`);
  const daySelected = await selectDay(picker, day);
  if (!daySelected) {
    warn(`Day ${day} NOT selectable`);
    return false;
  }

  // 6. Verify picker closed
  try {
    await picker.waitFor({ state: "hidden", timeout: 3000 });
    log(`Picker closed successfully`);
  } catch {
    warn(`Picker did NOT close after selection`);
  }

  log(`SUCCESS setCalendarByClicks`);
  return true;
}

/* ------------------------------------------------------------------ */
/* ----------------------------- HELPERS ----------------------------- */
/* ------------------------------------------------------------------ */

function parseIso(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return {
    year: y,
    monthIndex: m - 1,
    day: d,
  };
}

function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/* ------------------------------------------------------------------ */
/* ------------------------- FIND INPUT ------------------------------ */
/* ------------------------------------------------------------------ */

async function findInputByLabelProximity(
  page: Page,
  labelText: string,
  maxDepth: number = 7
): Promise<Locator> {
  log(`Searching label text: "${labelText}"`);

  const label = page.locator(`text="${labelText}"`).first();
  await label.waitFor({ state: "visible", timeout: 5000 });

  let current: Locator = label;

  for (let depth = 0; depth < maxDepth; depth++) {
    log(`Proximity search depth ${depth}`);

    const input = current.locator("input:not([type='hidden'])");
    if ((await input.count()) > 0) {
      log(`Input found as descendant at depth ${depth}`);
      return input.first();
    }

    const sibling = current.locator(
      "xpath=following-sibling::*//input"
    );
    if ((await sibling.count()) > 0) {
      log(`Input found in following sibling at depth ${depth}`);
      return sibling.first();
    }

    current = current.locator("xpath=..");
  }

  throw new Error("Input not found");
}

/* ------------------------------------------------------------------ */
/* ------------------------- OPEN PICKER ----------------------------- */
/* ------------------------------------------------------------------ */

async function openPicker(page: Page, input: Locator): Promise<void> {
  log(`Trying to open picker via icon button`);

  const container = input.locator("xpath=..");

  const iconButton = container.locator(
    "button[aria-label*='calendar'], button[aria-label*='date']"
  );

  if ((await iconButton.count()) > 0) {
    log(`Calendar icon found → clicking`);
    await iconButton.first().click();
    return;
  }

  log(`Calendar icon NOT found → clicking input`);
  await input.click();
}

/* ------------------------------------------------------------------ */
/* ------------------------- YEAR VIEW ------------------------------- */
/* ------------------------------------------------------------------ */

async function switchToYearView(picker: Locator): Promise<void> {
  const switchButton = picker.locator(
    "button[aria-label*='year'], button[aria-label*='switch']"
  );

  if ((await switchButton.count()) > 0) {
    log(`Year switch button found → clicking`);
    await switchButton.first().click();
    return;
  }

  const header = picker.locator(".MuiPickersCalendarHeader-label");
  if ((await header.count()) > 0) {
    log(`Header label found → clicking to switch year view`);
    await header.first().click();
    return;
  }

  warn(`Year switch control NOT found`);
}

async function selectYear(
  picker: Locator,
  year: number
): Promise<boolean> {
  const yearButton = picker.locator(
    `[role="button"]:has-text("${year}")`
  );

  const count = await yearButton.count();
  log(`Found ${count} year buttons matching ${year}`);

  if (count === 0) return false;

  await yearButton.first().scrollIntoViewIfNeeded();
  await yearButton.first().click();
  return true;
}

/* ------------------------------------------------------------------ */
/* ------------------------- MONTH ----------------------------------- */
/* ------------------------------------------------------------------ */

async function selectMonth(
  picker: Locator,
  monthIndex: number
): Promise<boolean> {
  const months = picker.locator('[role="gridcell"], button');
  const count = await months.count();

  log(`Month candidates found: ${count}`);

  if (count <= monthIndex) return false;

  const month = months.nth(monthIndex);
  await month.scrollIntoViewIfNeeded();
  await month.click();
  return true;
}

/* ------------------------------------------------------------------ */
/* ------------------------- DAY ------------------------------------- */
/* ------------------------------------------------------------------ */

async function selectDay(
  picker: Locator,
  day: number
): Promise<boolean> {
  const dayButton = picker.locator(
    `[role="gridcell"]:not(.Mui-disabled):has-text("${day}")`
  );

  const count = await dayButton.count();
  log(`Day candidates for ${day}: ${count}`);

  if (count === 0) return false;

  await dayButton.first().click();
  return true;
}

/* ------------------------------------------------------------------ */
/* ----------------------------- LOGGING ----------------------------- */
/* ------------------------------------------------------------------ */

function log(msg: string): void {
  console.log(`[Calendar][INFO] ${msg}`);
}

function warn(msg: string): void {
  console.warn(`[Calendar][WARN] ${msg}`);
}
