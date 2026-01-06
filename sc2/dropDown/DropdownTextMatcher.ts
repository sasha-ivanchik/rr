export function textEquals(
  actual: string,
  expected: string,
  caseSensitive: boolean
): boolean {
  return caseSensitive
    ? actual.trim() === expected.trim()
    : actual.trim().toLowerCase() === expected.trim().toLowerCase();
}
