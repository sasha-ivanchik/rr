import { Page } from "@playwright/test";
import { DropdownDetector } from "./DropdownDetector";
import { DropdownValidator } from "./DropdownValidator";
import { DropdownClearer } from "./DropdownClearer";
import { DropdownActions } from "./DropdownActions";
import { DropdownSelectOptions } from "./DropdownOptions";
import { DropdownSelectionResult } from "./DropdownResult";

export async function setDropdown(
  page: Page,
  label: string,
  values: string[],
  options?: DropdownSelectOptions
): Promise<DropdownSelectionResult> {
  const { type, root } = await DropdownDetector.detect(page, label);

  await DropdownValidator.validate(type, root, values);
  await DropdownClearer.clear(type, root);

  return DropdownActions.select(page, type, root, values, options);
}
