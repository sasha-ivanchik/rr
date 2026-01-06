import { Locator } from "@playwright/test";

/**
 * XPath locator for MUI classes with dynamic suffixes.
 * Example:
 *   muiClass(root, "MuiChip-deleteIcon")
 */
export function muiClass(root: Locator, classPrefix: string): Locator {
  return root.locator(
    `xpath=.//*[contains(@class,"${classPrefix}")]`
  );
}

/**
 * Finds nearest clickable ancestor for MUI icon / svg.
 */
export function muiClickableAncestor(el: Locator): Locator {
  return el.locator(
    'xpath=ancestor::*[self::button or @role="button" or contains(@class,"MuiChip-root")][1]'
  );
}
