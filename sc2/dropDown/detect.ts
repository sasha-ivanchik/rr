import { Page, Locator } from "@playwright/test";
import { DetectOptions, DropdownDetection } from "./types";
import { findLabelNode, resolveFieldRootFromLabel } from "./label";

async function pickSingle(
  locator: Locator,
  strict: boolean,
  name: string
): Promise<Locator> {
  const n = await locator.count();
  if (n === 0) {
    throw new Error(`[setDropdown] ${name} not found`);
  }
  if (strict && n > 1) {
    throw new Error(`[setDropdown] Ambiguous ${name}: found ${n}`);
  }
  return locator.first();
}

export async function detectDropdown(
  page: Page,
  label: string,
  opts: DetectOptions
): Promise<DropdownDetection> {
  const { caseSensitive = true, strict = true } = opts;

  // 1️⃣ НАДЁЖНО ищем label
  const labelNode = await findLabelNode(page, label, caseSensitive);
  const root = await resolveFieldRootFromLabel(labelNode);

  // 2️⃣ HTML <select> через for=""
  const forId = await labelNode.getAttribute("for");
  if (forId) {
    const sel = page.locator(`select[id="${forId}"]`);
    if (await sel.count()) {
      return {
        kind: "html-select",
        root,
        trigger: sel.first(),
        nativeSelect: sel.first(),
      };
    }
  }

  // 3️⃣ HTML <select> внутри root
  const nativeSelect = root.locator("select");
  if (await nativeSelect.count()) {
    const sel = await pickSingle(nativeSelect, strict, "native <select>");
    return {
      kind: "html-select",
      root,
      trigger: sel,
      nativeSelect: sel,
    };
  }

  // 4️⃣ MUI Autocomplete — input с aria-autocomplete
  const autoInput = root.locator(
    'input[aria-autocomplete], input[role="combobox"]'
  );

  if (await autoInput.count()) {
    const input = await pickSingle(autoInput, strict, "autocomplete input");

    return {
      kind: "mui-autocomplete",
      root,
      trigger: input, // 🔥 кликаем именно input
      input,
    };
  }

  // 5️⃣ MUI Select — aria-haspopup
  const popupTrigger = root.locator(
    '[aria-haspopup="listbox"], [aria-haspopup="menu"]'
  );

  if (await popupTrigger.count()) {
    const trigger = await pickSingle(popupTrigger, strict, "popup trigger");
    return {
      kind: "mui-select",
      root,
      trigger,
    };
  }

  // 6️⃣ MUI Select — MuiSelect-select (частый кейс)
  const muiSelect = root.locator(
    '.MuiSelect-select, .MuiSelect-root, button'
  );

  if (await muiSelect.count()) {
    const trigger = await pickSingle(muiSelect, strict, "MuiSelect trigger");
    return {
      kind: "mui-select",
      root,
      trigger,
    };
  }

  // ❌ FAIL — но теперь с нормальной диагностикой
  const rootHtml = await root.evaluate((n) => n.outerHTML.slice(0, 500));

  throw new Error(
    `[setDropdown] Cannot detect dropdown for label "${label}".\n` +
      `Root HTML (first 500 chars):\n${rootHtml}`
  );
}
