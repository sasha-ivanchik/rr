import { Page } from "@playwright/test";
import { detectDropdown } from "./detect";
import { clearDropdown } from "./clear";
import { pickValues } from "./pick";
import { withRetries } from "./retry";
import { DropdownResult, SetDropdownOptions } from "./types";

/**
 * Set dropdown by label + select exact option texts.
 * Returns:
 *   - false, if ALL requested options failed
 *   - { [optionText]: boolean } otherwise
 */
export async function setDropdown(
  page: Page,
  label: string,
  values: string[],
  options: SetDropdownOptions = {}
): Promise<DropdownResult> {
  const {
    caseSensitive = true,
    retries = 2,
    retryTimeoutMs = 1000,
    strict = true,
  } = options;

  if (!Array.isArray(values) || values.length === 0) {
    return false;
  }

  const detection = await detectDropdown(page, label, { caseSensitive, strict });

  // Очистка делается один раз перед выбором
  await withRetries(
    async () => clearDropdown(page, detection),
    { retries, retryTimeoutMs, label: `clear(${label})` }
  );

  // Выбор каждого значения (с ретраями на каждое)
  const resultMap: Record<string, boolean> = {};

  for (const value of values) {
    const ok = await withRetries(
      async () => pickValues(page, detection, [value], { caseSensitive, strict }),
      { retries, retryTimeoutMs, label: `pick("${value}") in (${label})` }
    );

    resultMap[value] = ok;
  }

  const anyOk = Object.values(resultMap).some(Boolean);
  return anyOk ? resultMap : false;
}

export * from "./types";
