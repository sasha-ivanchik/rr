import { Page, Locator } from "@playwright/test";

/**
 * Tries to set date in a strict MUI DatePicker input by probing common formats.
 * Never throws (returns boolean), logs each attempt, and guards against hangs.
 *
 * @param page Playwright Page
 * @param isoDate ISO date (YYYY-MM-DD)
 * @param label Label text
 * @returns true if UI accepted a format, false otherwise
 */
export async function setCalendar(
  page: Page,
  isoDate: string,
  label: string
): Promise<boolean> {
  if (!isValidIsoDate(isoDate)) {
    log("warn", `[Calendar] Invalid ISO date provided: "${isoDate}"`);
    return false;
  }

  let input: Locator;
  try {
    input = await findInputByLabelProximity(page, label);
  } catch {
    log("warn", `[Calendar] Input not found for label "${label}"`);
    return false;
  }

  await safe("makeEditable", () => makeEditable(page, input));
  await safe("closeCalendarIfOpened(initial)", () => closeCalendarIfOpened(page));

  const candidates = buildCandidateFormats(isoDate);

  for (const candidate of candidates) {
    log("info", `[Calendar] Trying candidate: "${candidate}"`);

    const attemptOk = await withTimeout(
      attemptSetOnce(page, input, candidate),
      2500
    );

    if (attemptOk === true) {
      log("info", `[Calendar] Accepted candidate: "${candidate}"`);
      return true;
    }

    log("info", `[Calendar] Rejected candidate: "${candidate}"`);

    // Extra cleanup between attempts to avoid being stuck in invalid state
    await safe("cleanupBetweenAttempts", async () => {
      await clearInput(input);
      await closeCalendarIfOpened(page);
      await input.blur().catch(() => {});
    });
  }

  log("warn", `[Calendar] No supported date format found for label "${label}"`);
  return false;
}

/* ------------------------------------------------------------------ */
/* ----------------------------- CORE TRY ---------------------------- */
/* ------------------------------------------------------------------ */

async function attemptSetOnce(
  page: Page,
  input: Locator,
  candidate: string
): Promise<boolean> {
  // Clear + type
  await clearInput(input);

  // Some strict inputs behave better with type() than fill()
  // We'll try fill first, then fallback to type
  const filled = await safeBool("fill", async () => {
    await input.fill(candidate);
    return true;
  });

  if (!filled) {
    // Fallback: click + type
    const typed = await safeBool("type", async () => {
      await input.click();
      await input.type(candidate, { delay: 10 });
      return true;
    });
    if (!typed) return false;
  }

  // Commit the value (different apps react differently)
  await safe("commit(Tab)", async () => {
    await input.press("Tab");
  });
  await safe("commit(Enter)", async () => {
    await input.press("Enter");
  });
  await safe("blur", async () => {
    await input.blur();
  });

  await safe("closeCalendarIfOpened", () => closeCalendarIfOpened(page));

  // Decide acceptance
  const accepted = await isAcceptedByUi(page, input);
  return accepted;
}

/* ------------------------------------------------------------------ */
/* ----------------------------- ACCEPTANCE -------------------------- */
/* ------------------------------------------------------------------ */

/**
 * Determines whether the UI accepted the entered date.
 * Rejected if:
 *  - aria-invalid=true
 *  - MUI error helper text is visible near the control
 *  - value is empty
 */
async function isAcceptedByUi(page: Page, input: Locator): Promise<boolean> {
  const value = await safeValue(() => input.inputValue());
  if (!value) return false;

  // 1) aria-invalid
  const ariaInvalid = await safeValue(() => input.getAttribute("aria-invalid"));
  if (ariaInvalid === "true") return false;

  // 2) MUI error state in nearest container
  // We search up a few levels and look for .Mui-error or helper text containing "Invalid"
  const container = await nearestContainer(input, 5);

  if (container) {
    const hasMuiErrorClass = await safeBool("hasMuiErrorClass", async () => {
      const err = container.locator(".Mui-error");
      return (await err.count()) > 0;
    });
    if (hasMuiErrorClass) return false;

    const helperHasInvalid = await safeBool("helperHasInvalid", async () => {
      const helper = container.locator(
        ".MuiFormHelperText-root, .Mui-error, [role='alert']"
      );
      if ((await helper.count()) === 0) return false;

      const text = (await helper.first().innerText().catch(() => "")) ?? "";
      return /invalid|format|date/i.test(text);
    });
    if (helperHasInvalid) return false;
  }

  // If no explicit invalid signals — accept
  return true;
}

/* ------------------------------------------------------------------ */
/* ----------------------------- LOCATORS ---------------------------- */
/* ------------------------------------------------------------------ */

/**
 * DOM proximity based input lookup:
 * - find element with exact text
 * - search descendants / siblings for input
 * - climb up and repeat
 */
async function findInputByLabelProximity(
  page: Page,
  labelText: string,
  maxDepth: number = 7
): Promise<Locator> {
  const label = page.locator(`text="${labelText}"`).first();
  await label.waitFor({ state: "visible", timeout: 5000 });

  let current: Locator = label;

  for (let depth = 0; depth < maxDepth; depth++) {
    const descendant = current.locator("input:not([type='hidden'])");
    if ((await descendant.count()) > 0) return descendant.first();

    const following = current.locator("xpath=following-sibling::*//input");
    if ((await following.count()) > 0) return following.first();

    const followingAny = current.locator("xpath=following::input[1]");
    if ((await followingAny.count()) > 0) return followingAny.first();

    current = current.locator("xpath=..");
  }

  throw new Error(`Input not found near label "${labelText}"`);
}

/**
 * Finds a nearby container for error/helper text checks.
 */
async function nearestContainer(input: Locator, maxUp: number): Promise<Locator | null> {
  let cur: Locator = input;
  for (let i = 0; i < maxUp; i++) {
    const parent = cur.locator("xpath=..");
    if ((await parent.count()) === 0) break;

    // Prefer MUI FormControl root if present
    const formControl = parent.locator(
      "xpath=self::*[contains(@class,'MuiFormControl-root')]"
    );
    if ((await formControl.count()) > 0) return formControl.first();

    cur = parent;
  }
  // fallback: use immediate parent
  const p = input.locator("xpath=..");
  if ((await p.count()) > 0) return p.first();
  return null;
}

/* ------------------------------------------------------------------ */
/* ----------------------------- FORMATS ----------------------------- */
/* ------------------------------------------------------------------ */

function buildCandidateFormats(iso: string): string[] {
  const [y, m, d] = iso.split("-");
  const mm = m;
  const dd = d;

  return uniq([
    // ISO
    `${y}-${mm}-${dd}`,

    // US common
    `${mm}/${dd}/${y}`,
    `${mm}-${dd}-${y}`,

    // EU common
    `${dd}/${mm}/${y}`,
    `${dd}.${mm}.${y}`,
    `${dd}-${mm}-${y}`,

    // Other
    `${y}/${mm}/${dd}`,

    // No leading zeros variants
    `${Number(mm)}/${Number(dd)}/${y}`,
    `${Number(dd)}/${Number(mm)}/${y}`,
    `${Number(mm)}-${Number(dd)}-${y}`,
    `${Number(dd)}-${Number(mm)}-${y}`,
  ]);
}

function uniq(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

/* ------------------------------------------------------------------ */
/* ------------------------------ INPUT ------------------------------ */
/* ------------------------------------------------------------------ */

function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
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

async function closeCalendarIfOpened(page: Page): Promise<void> {
  const popup = page.locator(".MuiPickersPopper-root, .MuiPopover-root");
  const visible = await popup.isVisible({ timeout: 150 }).catch(() => false);
  if (visible) {
    await page.keyboard.press("Escape").catch(() => {});
  }
}

/* ------------------------------------------------------------------ */
/* --------------------------- SAFETY UTILS -------------------------- */
/* ------------------------------------------------------------------ */

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return await Promise.race([
    p,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

async function safe(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    log("warn", `[Calendar] Step failed: ${name}`);
  }
}

async function safeBool(name: string, fn: () => Promise<boolean>): Promise<boolean> {
  try {
    return await fn();
  } catch {
    log("warn", `[Calendar] Step failed: ${name}`);
    return false;
  }
}

async function safeValue(fn: () => Promise<string | null>): Promise<string> {
  try {
    return (await fn()) ?? "";
  } catch {
    return "";
  }
}

function log(level: "info" | "warn", msg: string): void {
  // Replace with your logger if needed
  if (level === "warn") console.warn(msg);
  else console.log(msg);
}
