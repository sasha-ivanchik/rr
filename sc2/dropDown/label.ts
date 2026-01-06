import { Locator, Page } from "@playwright/test";

function buildExactTextRegex(text: string, caseSensitive: boolean): RegExp {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^\\s*${escaped}\\s*$`, caseSensitive ? "" : "i");
}

/**
 * 1) aria-labelledby (id reference)
 * 2) visible text
 */
export async function findLabelNode(
  page: Page,
  labelText: string,
  caseSensitive: boolean
): Promise<Locator> {
  const rx = buildExactTextRegex(labelText, caseSensitive);

  // 1. aria-labelledby -> label[id]
  const ariaLabelled = page.locator("[aria-labelledby]").filter({
    has: page.locator(`text=${labelText}`)
  });

  if (await ariaLabelled.count()) {
    const id = await ariaLabelled.first().getAttribute("aria-labelledby");
    if (id) {
      const labelById = page.locator(`#${CSS.escape(id)}`);
      if (await labelById.count()) return labelById.first();
    }
  }

  // 2. <label>
  const htmlLabel = page.locator("label").filter({ hasText: rx });
  if (await htmlLabel.count()) return htmlLabel.first();

  // 3. MUI InputLabel
  const muiLabel = page
    .locator(".MuiFormLabel-root, .MuiInputLabel-root")
    .filter({ hasText: rx });
  if (await muiLabel.count()) return muiLabel.first();

  // fallback
  return page.locator(`text=${labelText}`).first();
}

export async function resolveFieldRootFromLabel(labelNode: Locator): Promise<Locator> {
  const muiRoot = labelNode.locator(
    "xpath=ancestor::*[contains(@class,'MuiFormControl-root')][1]"
  );
  if (await muiRoot.count()) return muiRoot.first();

  const generic = labelNode.locator(
    "xpath=ancestor::*[.//input or .//select or .//*[@role='combobox']][1]"
  );
  if (await generic.count()) return generic.first();

  return labelNode.locator("xpath=..").first();
}
