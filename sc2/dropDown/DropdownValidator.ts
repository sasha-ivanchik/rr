import { Locator } from "@playwright/test";
import { DropdownType } from "./DropdownType";

export class DropdownValidator {
  static async validate(
    type: DropdownType,
    root: Locator,
    values: string[]
  ) {
    if (values.length === 0) {
      throw new Error("Dropdown values array is empty");
    }

    if (values.length > 1) {
      const isMulti = await this.isMulti(type, root);
      if (!isMulti) {
        throw new Error(
          `Dropdown does not support multiple values: ${values.join(", ")}`
        );
      }
    }
  }

  private static async isMulti(
    type: DropdownType,
    root: Locator
  ): Promise<boolean> {
    switch (type) {
      case DropdownType.MUI_AUTOCOMPLETE:
        return true;

      case DropdownType.HTML_SELECT:
        return (await root.getAttribute("multiple")) !== null;

      case DropdownType.MUI_SELECT:
      default:
        return false;
    }
  }
}
