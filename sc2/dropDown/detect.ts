import { Page } from "@playwright/test";
import { DetectOptions, DropdownDetection } from "./types";
import { findLabelNode, resolveFieldRootFromLabel } from "./label";

async function pickSingle(locator: any, strict: boolean, name: string) {
  const n = await locator.count();
  if (strict && n > 1) {
    throw new Error(`[setDropdown] Ambiguous ${name}: ${n}`);
  }
  return locator.first();
}

export async function detectDropdown(
  page: Page,
  label: string,
  opts: DetectOptions
): Promise<DropdownDetection> {
  const { caseSensitive = true, strict = true } = opts;

  const labelNode = await findLabelNode(page, label, caseSensitive);
  const root = await resolveFieldRootFromLabel(labelNode);

  // HTML select via for=""
  const forId = await labelNode.getAttribute("for");
  if (forId) {
    const sel = page.locator(`select#${CSS.escape(forId)}`);
    if (await sel.count()) {
      return {
        kind: "html-select",
        root,
        trigger: sel.first(),
        nativeSelect: sel.first(),
      };
    }
  }

  // native select inside root
  const nativeSelect = root.locator("select");
  if (await nativeSelect.count()) {
    const sel = await pickSingle(nativeSelect, strict, "native select");
    return { kind: "html-select", root, trigger: sel, nativeSelect: sel };
  }

  // combobox
  const combo = root.locator("[role='combobox']");
  if (await combo.count()) {
    const trigger = await pickSingle(combo, strict, "combobox");

    // detect autocomplete input
    const input = root.locator("input");

    const isAuto =
      (await input.count()) > 0 ||
      (await trigger.getAttribute("aria-autocomplete")) !== null;

    if (isAuto) {
      return {
        kind: "mui-autocomplete",
        root,
        trigger,
        input: input.first(),
      };
    }

    return { kind: "mui-select", root, trigger };
  }

  // fallback: aria-haspopup
  const popupTrigger = root.locator("[aria-haspopup='listbox'],[aria-haspopup='menu']");
  if (await popupTrigger.count()) {
    const trigger = await pickSingle(popupTrigger, strict, "popup trigger");
    return { kind: "mui-select", root, trigger };
  }

  throw new Error(`[setDropdown] Cannot detect dropdown for label "${label}"`);
}
