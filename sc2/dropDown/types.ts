import { Locator } from "@playwright/test";

export type DropdownKind = "mui-autocomplete" | "mui-select" | "html-select";

export interface DetectOptions {
  caseSensitive?: boolean;
  strict?: boolean;
}

export interface SetDropdownOptions {
  caseSensitive?: boolean;
  retries?: number;
  retryTimeoutMs?: number;
  strict?: boolean;
}

export type DropdownResult = false | { [optionText: string]: boolean };

export interface DropdownDetection {
  kind: DropdownKind;
  root: Locator;
  trigger: Locator;
  input?: Locator;     
  nativeSelect?: Locator;
}
