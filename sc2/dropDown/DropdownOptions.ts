export type DropdownSelectOptions = {
  caseSensitive?: boolean;
  retries?: number;
  retryTimeoutMs?: number;
};

export const DEFAULT_DROPDOWN_OPTIONS: Required<DropdownSelectOptions> = {
  caseSensitive: true,
  retries: 2,
  retryTimeoutMs: 1000,
};
